
import React, { useEffect, useState } from "react";
import { SchedulingGroup } from "@/services/schedulingService";
import { supabase } from "@/integrations/supabase/client";

interface RouteMapProps {
  pickupGroups: SchedulingGroup[];
  deliveryGroups: SchedulingGroup[];
}

const RouteMap: React.FC<RouteMapProps> = ({ pickupGroups, deliveryGroups }) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  
  // Fetch API key from Supabase edge function
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-geoapify-key', {
          method: 'GET'
        });
        
        if (error) {
          console.error("Error fetching Geoapify API key:", error);
          setMapError("Failed to load map API key. Please try again later.");
          return;
        }
        
        if (data && data.apiKey) {
          setApiKey(data.apiKey);
        } else {
          setMapError("API key not configured. Map may not display properly.");
        }
      } catch (err) {
        console.error("Failed to fetch Geoapify API key:", err);
        setMapError("Failed to load map API key. Please try again later.");
        
        // Fall back to environment variable if edge function fails
        const envApiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
        if (envApiKey) {
          setApiKey(envApiKey);
          setMapError(null);
        }
      }
    };
    
    fetchApiKey();
  }, []);
  
  useEffect(() => {
    // Skip if no groups to display or no API key
    if ((pickupGroups.length === 0 && deliveryGroups.length === 0) || !apiKey) {
      return;
    }
    
    // Load map only once
    if (!mapLoaded) {
      // Create a script element for the Geoapify Map
      const script = document.createElement('script');
      script.src = 'https://maps.geoapify.com/v1/map.js';
      script.async = true;
      
      script.onload = () => {
        setMapLoaded(true);
        initializeMap();
      };
      
      script.onerror = () => {
        setMapError("Failed to load the map library");
      };
      
      document.body.appendChild(script);
      
      return () => {
        document.body.removeChild(script);
      };
    } else {
      // Map already loaded, initialize it
      initializeMap();
    }
  }, [pickupGroups, deliveryGroups, apiKey, mapLoaded]);
  
  const initializeMap = () => {
    // Skip if the maplibregl is not available on window or no API key
    if (!window.maplibregl || !apiKey) {
      console.error("maplibregl is not available on window or API key is missing");
      return;
    }
    
    // Clear previous map
    const mapContainer = document.getElementById('route-map');
    if (mapContainer) {
      mapContainer.innerHTML = '';
    }
    
    // Get all locations from groups
    const allLocations = [
      ...pickupGroups.map(g => ({
        group: g,
        type: 'pickup',
        // Get the first order's sender address
        address: g.orders[0].sender.address,
        name: g.orders[0].sender.name
      })),
      ...deliveryGroups.map(g => ({
        group: g,
        type: 'delivery',
        // Get the first order's receiver address
        address: g.orders[0].receiver.address,
        name: g.orders[0].receiver.name
      }))
    ];
    
    if (allLocations.length === 0) {
      return;
    }
    
    // Create centralized coordinates (UK centered by default)
    const center = [-0.118092, 51.509865]; // London coordinates
    
    // Initialize map
    const map = new window.maplibregl.Map({
      container: 'route-map',
      style: `https://maps.geoapify.com/v1/styles/osm-carto/style.json?apiKey=${apiKey}`,
      center: center,
      zoom: 11
    });
    
    // Add navigation control
    map.addControl(new window.maplibregl.NavigationControl());
    
    // Add markers when map is loaded
    map.on('load', function() {
      // Add markers for each location
      allLocations.forEach((location, index) => {
        const address = location.address;
        const fullAddress = `${address.street}, ${address.city}, ${address.zipCode}`;
        
        // Geocode the address
        fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(fullAddress)}&apiKey=${apiKey}`)
          .then(response => response.json())
          .then(data => {
            if (data.features && data.features.length > 0) {
              const coords = data.features[0].geometry.coordinates;
              
              // Create a marker element
              const el = document.createElement('div');
              el.className = 'custom-marker';
              el.style.width = '30px';
              el.style.height = '30px';
              el.style.borderRadius = '50%';
              el.style.display = 'flex';
              el.style.justifyContent = 'center';
              el.style.alignItems = 'center';
              el.style.fontWeight = 'bold';
              el.style.color = 'white';
              el.style.backgroundColor = location.type === 'pickup' ? '#3b82f6' : '#ef4444';
              el.innerText = (index + 1).toString();
              
              // Add marker to map
              new window.maplibregl.Marker(el)
                .setLngLat(coords)
                .setPopup(
                  new window.maplibregl.Popup({ offset: 25 })
                    .setHTML(`
                      <div>
                        <p><strong>${location.name}</strong></p>
                        <p>${location.type === 'pickup' ? 'Collection' : 'Delivery'}</p>
                        <p>${fullAddress}</p>
                      </div>
                    `)
                )
                .addTo(map);
            }
          })
          .catch(error => {
            console.error('Geocoding error:', error);
          });
      });
      
      // If we have at least 2 locations, draw a route
      if (allLocations.length >= 2) {
        // Get coordinates for the first 10 locations (API limit for free tier)
        const maxLocations = Math.min(allLocations.length, 10);
        const locationPromises = allLocations.slice(0, maxLocations).map(location => {
          const address = location.address;
          const fullAddress = `${address.street}, ${address.city}, ${address.zipCode}`;
          
          return fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(fullAddress)}&apiKey=${apiKey}`)
            .then(response => response.json())
            .then(data => {
              if (data.features && data.features.length > 0) {
                return data.features[0].geometry.coordinates;
              }
              return null;
            });
        });
        
        // When all geocoding is done, calculate route
        Promise.all(locationPromises)
          .then(coordsArray => {
            // Filter out null values
            const validCoords = coordsArray.filter(coords => coords !== null);
            
            if (validCoords.length >= 2) {
              // Format waypoints for the Routing API
              const waypoints = validCoords.map(coords => coords.join(',')).join('|');
              
              // Get route
              fetch(`https://api.geoapify.com/v1/routing?waypoints=${waypoints}&mode=drive&apiKey=${apiKey}`)
                .then(response => response.json())
                .then(routeData => {
                  if (routeData.features && routeData.features.length > 0) {
                    // Add the route to the map
                    map.addSource('route', {
                      type: 'geojson',
                      data: {
                        type: 'Feature',
                        properties: {},
                        geometry: routeData.features[0].geometry
                      }
                    });
                    
                    map.addLayer({
                      id: 'route',
                      type: 'line',
                      source: 'route',
                      layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                      },
                      paint: {
                        'line-color': '#4ade80',
                        'line-width': 6,
                        'line-opacity': 0.7
                      }
                    });
                    
                    // Fit map to the route
                    const bounds = routeData.features[0].bbox;
                    map.fitBounds([
                      [bounds[0], bounds[1]],
                      [bounds[2], bounds[3]]
                    ], { padding: 50 });
                  }
                })
                .catch(error => {
                  console.error('Routing error:', error);
                });
            }
          });
      }
    });
  };
  
  if (mapError) {
    return (
      <div className="bg-red-50 p-4 rounded-md border border-red-200 text-red-600">
        <h3 className="font-medium mb-2">Map Error</h3>
        <p>{mapError}</p>
      </div>
    );
  }
  
  if (pickupGroups.length === 0 && deliveryGroups.length === 0) {
    return (
      <div className="bg-muted p-4 rounded-md text-center text-muted-foreground">
        <p>No orders scheduled for this day</p>
        <p className="text-sm mt-2">Schedule orders to see the route map</p>
      </div>
    );
  }
  
  return (
    <div className="relative">
      <div 
        id="route-map" 
        className="w-full h-[400px] bg-muted rounded-md"
      >
        {(!mapLoaded || !apiKey) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-end gap-2 text-xs">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-blue-500 mr-1"></div>
          <span>Collections</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
          <span>Deliveries</span>
        </div>
      </div>
    </div>
  );
};

export default RouteMap;
