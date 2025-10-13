import { DEPOT_LOCATION } from "@/constants/depot";

interface Job {
  orderId: string;
  type: 'collection' | 'delivery';
  contactName: string;
  address: string;
  phoneNumber: string;
  order: any;
  lat: number;
  lon: number;
}

interface OptimizedJob extends Job {
  sequenceOrder: number;
  estimatedArrivalTime: string;
  estimatedDepartureTime: string;
  timeslotWindow: string;
}

export const optimizeRouteWithGeoapify = async (
  jobs: Job[],
  startDate: Date,
  startTime: string = "09:00"
): Promise<OptimizedJob[]> => {
  const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
  
  if (!apiKey) {
    throw new Error('Geoapify API key not configured');
  }

  // Build shipments array with dependency logic
  const shipments = [];
  const orderMap = new Map<string, { collection?: Job, delivery?: Job }>();

  // Group jobs by order ID to identify same-day pickup+delivery
  jobs.forEach(job => {
    if (!orderMap.has(job.orderId)) {
      orderMap.set(job.orderId, {});
    }
    const orderJobs = orderMap.get(job.orderId)!;
    if (job.type === 'collection') {
      orderJobs.collection = job;
    } else {
      orderJobs.delivery = job;
    }
  });

  // Create shipments with dependencies for same-day orders
  orderMap.forEach((orderJobs, orderId) => {
    const { collection, delivery } = orderJobs;

    if (collection) {
      shipments.push({
        id: `${orderId}-pickup`,
        pickup: {
          location: [collection.lat, collection.lon],
          duration: 900  // 15 minutes in seconds
        },
        metadata: {
          jobType: 'collection',
          orderId,
          contactName: collection.contactName,
          phoneNumber: collection.phoneNumber,
          address: collection.address
        }
      });
    }

    if (delivery) {
      const deliveryShipment: any = {
        id: `${orderId}-delivery`,
        pickup: {
          location: [delivery.lat, delivery.lon],
          duration: 900
        },
        metadata: {
          jobType: 'delivery',
          orderId,
          contactName: delivery.contactName,
          phoneNumber: delivery.phoneNumber,
          address: delivery.address
        }
      };

      // If there's a collection in the same route, add dependency
      if (collection) {
        deliveryShipment.depends_on = [`${orderId}-pickup`];
      }

      shipments.push(deliveryShipment);
    }
  });

  // Format start time as ISO 8601
  const startDateTime = new Date(startDate);
  const [hours, minutes] = startTime.split(':').map(Number);
  startDateTime.setHours(hours, minutes, 0, 0);

  // Build API request body
  const requestBody = {
    mode: "light_truck",
    agents: [{
      start_location: [DEPOT_LOCATION.lat, DEPOT_LOCATION.lon],
      end_location: [DEPOT_LOCATION.lat, DEPOT_LOCATION.lon],
      start_time: startDateTime.toISOString()
    }],
    shipments,
    optimization: "time"
  };

  console.log('Route optimization request:', requestBody);

  // Call Geoapify Route Planner API
  const response = await fetch(
    `https://api.geoapify.com/v1/routeplanner?apiKey=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Route Planner API error:', errorData);
    throw new Error(`Route optimization failed: ${response.status}`);
  }

  const data = await response.json();
  console.log('Route optimization response:', data);

  // Parse results and create optimized jobs list
  const optimizedJobs: OptimizedJob[] = [];
  const route = data.features[0];
  const steps = route.properties.steps;

  let sequenceCounter = 1; // Start from 1

  steps.forEach((step: any) => {
    if (step.type === 'start' || step.type === 'end') return;

    const shipmentId = step.shipment_id;
    const metadata = shipments.find(s => s.id === shipmentId)?.metadata;
    
    if (!metadata) return;

    const arrivalTime = new Date(step.arrival_time);
    const departureTime = new Date(step.departure_time);

    const arrivalTimeStr = arrivalTime.toTimeString().slice(0, 5);
    const departureTimeStr = departureTime.toTimeString().slice(0, 5);

    // Calculate 3-hour timeslot window
    const windowEnd = new Date(arrivalTime.getTime() + 3 * 60 * 60 * 1000);
    const timeslotWindow = `${arrivalTimeStr} to ${windowEnd.toTimeString().slice(0, 5)}`;

    const originalJob = jobs.find(
      j => j.orderId === metadata.orderId && j.type === metadata.jobType
    );

    if (originalJob) {
      optimizedJobs.push({
        ...originalJob,
        sequenceOrder: sequenceCounter++, // Increment after assignment
        estimatedArrivalTime: arrivalTimeStr,
        estimatedDepartureTime: departureTimeStr,
        timeslotWindow
      });
    }
  });

  return optimizedJobs;
};
