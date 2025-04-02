from fastapi import FastAPI, HTTPException, Depends, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader, APIKey
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Tuple
import googlemaps
import uvicorn
import os
import logging
from datetime import datetime, timedelta
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import time
import uuid
import requests
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Courier Route Optimization API")

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key security
API_KEY_NAME = "X-API-KEY"
API_KEY = os.environ.get("API_KEY")  # Set this in your environment variables

api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

async def get_api_key(api_key_header: str = Security(api_key_header)):
    if not API_KEY:
        # If no API key is set, don't validate in development
        return "no_api_key_set"
    if api_key_header == API_KEY:
        return api_key_header
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, detail="Could not validate API key"
    )

# Initialize Google Maps client
GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")
if not GOOGLE_MAPS_API_KEY:
    logger.warning("GOOGLE_MAPS_API_KEY not set! Time calculations will fail.")

gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY) if GOOGLE_MAPS_API_KEY else None

# Load depot location - Default to Birmingham UK
DEPOT_LOCATION = os.environ.get("DEPOT_LOCATION", "Birmingham, UK")

# Data models
class JobModel(BaseModel):
    id: str
    location: str
    type: str  # 'collection' or 'delivery'
    related_job_id: Optional[str] = None
    preferred_date: Optional[List[str]] = None

class JobUpdateModel(BaseModel):
    location: Optional[str] = None
    type: Optional[str] = None
    related_job_id: Optional[str] = None
    preferred_date: Optional[List[str]] = None

class DriverModel(BaseModel):
    id: str
    available_hours: int = 9  # Default 9 hours
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class DriverUpdateModel(BaseModel):
    available_hours: Optional[int] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class OptimizationRequest(BaseModel):
    jobs: List[JobModel]
    drivers: List[DriverModel]
    num_drivers_per_day: int = Field(..., gt=0)

class JobStop(BaseModel):
    job_id: str
    window: List[int]  # [start_minute, end_minute]

class RouteModel(BaseModel):
    driver_id: str
    day: int  # 1-5
    stops: List[JobStop]
    total_time: int  # minutes

class OptimizationResponse(BaseModel):
    routes: List[RouteModel]
    unassigned: List[str]  # job_ids

# In-memory storage for development/testing
# In production, you would use a database
jobs_db = {}
drivers_db = {}

# Helper functions
def compute_time_matrix(locations):
    """Calculate travel time matrix using Google Routes API"""
    if not GOOGLE_MAPS_API_KEY:
        # Use dummy matrix with estimated times if no API key is provided
        logger.warning("Using dummy time matrix as Google Maps API key is not set")
        n = len(locations)
        return [[max(30, abs(i-j) * 20) for j in range(n)] for i in range(n)]
    
    try:
        logger.info(f"Computing travel times for {len(locations)} locations using Routes API")
        matrix = []
        
        # Define the Routes API endpoint
        routes_url = "https://routes.googleapis.com/directions/v2:computeRouteMatrix"
        
        # Process each origin-destination pair
        for origin_idx, origin in enumerate(locations):
            row = []
            
            # Process in batches to stay within rate limits
            for i in range(0, len(locations), 10):
                batch_destinations = locations[i:i+10]
                
                # Prepare the request body
                request_body = {
                    "origins": [{"address": origin}],
                    "destinations": [{"address": dest} for dest in batch_destinations],
                    "travelMode": "DRIVE",
                    "routingPreference": "TRAFFIC_AWARE",
                    "departureTime": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
                }
                
                # Make the API request
                response = requests.post(
                    routes_url,
                    headers={
                        "Content-Type": "application/json",
                        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                        "X-Goog-FieldMask": "originIndex,destinationIndex,duration"
                    },
                    data=json.dumps(request_body)
                )
                
                if response.status_code != 200:
                    logger.error(f"Routes API error: {response.text}")
                    raise Exception(f"Routes API error: {response.status_code}")
                
                result = response.json()
                
                # Extract duration values in seconds, convert to minutes
                for element in result.get("originDestinationPairs", []):
                    if "duration" in element:
                        # Convert seconds to minutes and round up
                        duration_seconds = int(element["duration"].replace("s", ""))
                        row.append(duration_seconds // 60)
                    else:
                        # If location can't be reached, use a large value
                        row.append(9999)
                
                # Sleep briefly to avoid hitting rate limits
                time.sleep(0.1)
            
            matrix.append(row)
        
        logger.info("Time matrix computation completed using Routes API")
        return matrix
    
    except Exception as e:
        logger.error(f"Error computing time matrix: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute travel times: {str(e)}"
        )

def create_data_model(jobs, num_drivers_per_day, max_hours_per_driver=9):
    """Prepare data for the OR-Tools solver"""
    # Extract unique locations (depot + all job locations)
    all_locations = [DEPOT_LOCATION] + [job.location for job in jobs]
    unique_locations = []
    location_indices = {}
    
    # Create lookup for locations to avoid duplicates
    for location in all_locations:
        if location not in location_indices:
            location_indices[location] = len(unique_locations)
            unique_locations.append(location)
    
    # Compute travel time matrix
    time_matrix = compute_time_matrix(unique_locations)
    
    # Map jobs to their location indices
    jobs_with_indices = []
    for job in jobs:
        location_idx = location_indices[job.location]
        jobs_with_indices.append({
            "id": job.id,
            "location_idx": location_idx,
            "type": job.type,
            "related_job_id": job.related_job_id,
            "preferred_date": job.preferred_date
        })
    
    # Create job pairs for collection-delivery constraints
    job_pairs = []
    job_id_to_idx = {job["id"]: i for i, job in enumerate(jobs_with_indices)}
    
    for i, job in enumerate(jobs_with_indices):
        if job["type"] == "collection" and job["related_job_id"]:
            related_idx = job_id_to_idx.get(job["related_job_id"])
            if related_idx is not None:
                job_pairs.append((i, related_idx))
    
    # Create preferred dates index - which jobs can be done on which days
    jobs_by_day = [[] for _ in range(5)]  # 5 days
    
    for i, job in enumerate(jobs_with_indices):
        if job["preferred_date"]:
            # Parse preferred dates and map to days 0-4
            for date_str in job["preferred_date"]:
                try:
                    date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    # Calculate day index (0-4) based on current date
                    today = datetime.now().date()
                    job_date = date_obj.date()
                    day_diff = (job_date - today).days
                    
                    if 0 <= day_diff < 5:
                        jobs_by_day[day_diff].append(i)
                except:
                    # If date parsing fails, allow job on any day
                    for d in range(5):
                        jobs_by_day[d].append(i)
        else:
            # If no preferred date, allow job on any day
            for d in range(5):
                jobs_by_day[d].append(i)
    
    return {
        'time_matrix': time_matrix,
        'num_locations': len(unique_locations),
        'depot': 0,  # Depot is always the first location
        'num_vehicles': num_drivers_per_day,
        'jobs': jobs_with_indices,
        'job_pairs': job_pairs,
        'jobs_by_day': jobs_by_day,
        'max_time_per_vehicle': max_hours_per_driver * 60  # Convert hours to minutes
    }

def solve_vrp(data_model, day_index):
    """Solve Vehicle Routing Problem for a specific day"""
    # Create routing model
    manager = pywrapcp.RoutingIndexManager(
        data_model['num_locations'],
        data_model['num_vehicles'],
        data_model['depot']
    )
    routing = pywrapcp.RoutingModel(manager)
    
    # Define transit callback
    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return data_model['time_matrix'][from_node][to_node]
    
    transit_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
    
    # Add time dimension
    routing.AddDimension(
        transit_callback_index,
        60,  # Allow waiting time (slack)
        data_model['max_time_per_vehicle'],  # Maximum time per vehicle
        False,  # Don't force start cumul to zero
        'Time'
    )
    
    time_dimension = routing.GetDimensionOrDie('Time')
    
    # Add pickup and delivery pairs constraints
    for pair in data_model['job_pairs']:
        pickup_job = data_model['jobs'][pair[0]]
        delivery_job = data_model['jobs'][pair[1]]
        
        pickup_index = manager.NodeToIndex(pickup_job['location_idx'])
        delivery_index = manager.NodeToIndex(delivery_job['location_idx'])
        
        routing.AddPickupAndDelivery(pickup_index, delivery_index)
        routing.solver().Add(
            routing.VehicleVar(pickup_index) == routing.VehicleVar(delivery_index)
        )
        routing.solver().Add(
            time_dimension.CumulVar(pickup_index) <= time_dimension.CumulVar(delivery_index)
        )
    
    # Allowed locations for this day
    allowed_jobs = data_model['jobs_by_day'][day_index]
    allowed_locations = set([data_model['jobs'][j]['location_idx'] for j in allowed_jobs])
    allowed_locations.add(0)  # Add depot
    
    # Set allowed nodes for each vehicle
    for vehicle_id in range(data_model['num_vehicles']):
        # Skip nodes that aren't allowed on this day
        for node_idx in range(1, data_model['num_locations']):
            if node_idx not in allowed_locations:
                routing.VehicleVar(manager.NodeToIndex(node_idx)).RemoveValue(vehicle_id)
    
    # Setting first solution heuristic
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.seconds = 30  # Limit search time
    
    # Solve the problem
    solution = routing.SolveWithParameters(search_parameters)
    
    # Extract routes
    routes = []
    unassigned = []
    
    if solution:
        time_dimension = routing.GetDimensionOrDie('Time')
        
        for vehicle_id in range(data_model['num_vehicles']):
            index = routing.Start(vehicle_id)
            route = []
            route_time = 0
            
            while not routing.IsEnd(index):
                node_index = manager.IndexToNode(index)
                
                # Skip depot in stops
                if node_index != 0:
                    # Find which job this location belongs to
                    for job_idx, job in enumerate(data_model['jobs']):
                        if job['location_idx'] == node_index:
                            time_var = time_dimension.CumulVar(index)
                            # Get time window: 3-hour window from arrival time
                            arrival_time = solution.Min(time_var)
                            window_start = arrival_time
                            window_end = min(arrival_time + 180, data_model['max_time_per_vehicle'])  # 3-hour window
                            
                            route.append({
                                'job_id': job['id'],
                                'window': [window_start, window_end]
                            })
                            break
                
                previous_index = index
                index = solution.Value(routing.NextVar(index))
                route_time += time_callback(previous_index, index)
            
            if route:  # Only add non-empty routes
                routes.append({
                    'vehicle_id': vehicle_id,
                    'stops': route,
                    'total_time': route_time
                })
    
    # Determine unassigned nodes
    for job_idx, job in enumerate(data_model['jobs']):
        location_idx = job['location_idx']
        job_id = job['id']
        
        # Check if this job's location is used in any route
        is_assigned = False
        for route in routes:
            if any(stop['job_id'] == job_id for stop in route['stops']):
                is_assigned = True
                break
        
        if not is_assigned and job_idx in allowed_jobs:
            unassigned.append(job_id)
    
    return routes, unassigned

@app.get("/api/jobs", response_model=List[JobModel])
async def get_jobs(api_key: APIKey = Depends(get_api_key)):
    """Get all jobs"""
    return list(jobs_db.values())

@app.get("/api/jobs/{job_id}", response_model=JobModel)
async def get_job(job_id: str, api_key: APIKey = Depends(get_api_key)):
    """Get a specific job by ID"""
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs_db[job_id]

@app.post("/api/jobs", response_model=JobModel, status_code=status.HTTP_201_CREATED)
async def create_job(job: JobModel, api_key: APIKey = Depends(get_api_key)):
    """Create a new job"""
    if not job.id:
        job.id = str(uuid.uuid4())
    jobs_db[job.id] = job
    return job

@app.put("/api/jobs/{job_id}", response_model=JobModel)
async def update_job(job_id: str, job_update: JobUpdateModel, api_key: APIKey = Depends(get_api_key)):
    """Update an existing job"""
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    
    current_job = jobs_db[job_id]
    update_data = job_update.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(current_job, key, value)
    
    jobs_db[job_id] = current_job
    return current_job

@app.delete("/api/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: str, api_key: APIKey = Depends(get_api_key)):
    """Delete a job"""
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    del jobs_db[job_id]
    return None

@app.get("/api/drivers", response_model=List[DriverModel])
async def get_drivers(api_key: APIKey = Depends(get_api_key)):
    """Get all drivers"""
    return list(drivers_db.values())

@app.get("/api/drivers/{driver_id}", response_model=DriverModel)
async def get_driver(driver_id: str, api_key: APIKey = Depends(get_api_key)):
    """Get a specific driver by ID"""
    if driver_id not in drivers_db:
        raise HTTPException(status_code=404, detail="Driver not found")
    return drivers_db[driver_id]

@app.post("/api/drivers", response_model=DriverModel, status_code=status.HTTP_201_CREATED)
async def create_driver(driver: DriverModel, api_key: APIKey = Depends(get_api_key)):
    """Create a new driver"""
    if not driver.id:
        driver.id = str(uuid.uuid4())
    drivers_db[driver.id] = driver
    return driver

@app.put("/api/drivers/{driver_id}", response_model=DriverModel)
async def update_driver(driver_id: str, driver_update: DriverUpdateModel, api_key: APIKey = Depends(get_api_key)):
    """Update an existing driver"""
    if driver_id not in drivers_db:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    current_driver = drivers_db[driver_id]
    update_data = driver_update.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(current_driver, key, value)
    
    drivers_db[driver_id] = current_driver
    return current_driver

@app.delete("/api/drivers/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_driver(driver_id: str, api_key: APIKey = Depends(get_api_key)):
    """Delete a driver"""
    if driver_id not in drivers_db:
        raise HTTPException(status_code=404, detail="Driver not found")
    del drivers_db[driver_id]
    return None

@app.post("/api/optimize", response_model=OptimizationResponse)
async def optimize_routes(
    request: OptimizationRequest,
    api_key: APIKey = Depends(get_api_key)
):
    """Optimize courier routes based on input jobs and constraints"""
    start_time = time.time()
    logger.info(f"Starting route optimization for {len(request.jobs)} jobs")
    
    try:
        # Validate input data
        if not request.jobs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No jobs provided for optimization"
            )
        
        # Prepare data model for OR-Tools
        max_driver_hours = max([d.available_hours for d in request.drivers], default=9)
        data_model = create_data_model(request.jobs, request.num_drivers_per_day, max_driver_hours)
        
        # Solve VRP for each day
        all_routes = []
        all_unassigned = []
        
        for day in range(5):  # 5 days
            day_routes, day_unassigned = solve_vrp(data_model, day)
            
            # Assign driver IDs based on available drivers
            driver_ids = [d.id for d in request.drivers]
            for i, route in enumerate(day_routes):
                if i < len(driver_ids):
                    driver_id = driver_ids[i]
                else:
                    driver_id = f"additional-driver-{i-len(driver_ids)+1}"
                
                all_routes.append(RouteModel(
                    driver_id=driver_id,
                    day=day+1,  # Convert to 1-indexed day
                    stops=route['stops'],
                    total_time=route['total_time']
                ))
            
            # Track unassigned jobs
            all_unassigned.extend(day_unassigned)
        
        # Remove duplicates from unassigned (a job might be unassigned on multiple days)
        all_unassigned = list(set(all_unassigned))
        
        logger.info(f"Route optimization completed in {time.time() - start_time:.2f} seconds")
        logger.info(f"Created {len(all_routes)} routes with {len(all_unassigned)} unassigned jobs")
        
        return OptimizationResponse(
            routes=all_routes,
            unassigned=all_unassigned
        )
    
    except Exception as e:
        logger.error(f"Route optimization failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Route optimization failed: {str(e)}"
        )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "google_maps_api": bool(gmaps)}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
