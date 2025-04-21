import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { OrderData } from '@/pages/JobScheduling';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';

// Fix Leaflet icon issues
const fixLeafletIcon = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  });
};

interface JobMapProps {
  orders?: OrderData[];
}

// Function to check if a point is inside a polygon - export it so it can be used elsewhere
export const isPointInPolygon = (point: [number, number], polygon: number[][]) => {
  const x = point[0], y = point[1];
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
};

// Function to determine which polygon a location belongs to - export for reuse
export const getPolygonSegment = (lat: number, lng: number): number | null => {
  for (let i = 0; i < segmentGeoJSON.features.length; i++) {
    const polygon = segmentGeoJSON.features[i].geometry.coordinates[0];
    if (isPointInPolygon([lng, lat], polygon)) {
      return i + 1;
    }
  }
  return null;
};

// Extract locations function updated to use separate sender and receiver polygon segments
const extractLocations = (orders: OrderData[] = []) => {
  const locations: { 
    address: string; 
    lat: number; 
    lng: number;
    type: 'collection' | 'delivery';
    orderNumber: string;
    date?: Date;
    polygonSegment?: number;
  }[] = [];
  
  console.log(`Extracting locations from ${orders.length} orders`);
  
  orders.forEach(order => {
    // Add sender location if coordinates exist
    if (order.sender.address.lat && order.sender.address.lon) {
      locations.push({
        address: `${order.sender.address.street}, ${order.sender.address.city}`,
        lat: order.sender.address.lat,
        lng: order.sender.address.lon,
        type: 'collection',
        orderNumber: order.tracking_number || 'No tracking number',
        date: order.scheduled_pickup_date ? new Date(order.scheduled_pickup_date) : undefined,
        polygonSegment: order.senderPolygonSegment
      });
    }
    
    // Add receiver location if coordinates exist
    if (order.receiver.address.lat && order.receiver.address.lon) {
      locations.push({
        address: `${order.receiver.address.street}, ${order.receiver.address.city}`,
        lat: order.receiver.address.lat,
        lng: order.receiver.address.lon,
        type: 'delivery',
        orderNumber: order.tracking_number || 'No tracking number',
        date: order.scheduled_delivery_date ? new Date(order.scheduled_delivery_date) : undefined,
        polygonSegment: order.receiverPolygonSegment
      });
    }
  });
  
  // Sort locations by date if available
  const sortedLocations = locations.sort((a, b) => {
    // If both locations have dates, sort by date
    if (a.date && b.date) {
      return a.date.getTime() - b.date.getTime();
    }
    // If only one has a date, put the one with date first
    if (a.date) return -1;
    if (b.date) return 1;
    // If neither has a date, maintain original order
    return 0;
  });
  
  // If no locations found, use default location
  if (sortedLocations.length === 0) {
    return [{
      address: 'London',
      lat: 51.5074,
      lng: -0.1278,
      type: 'collection' as const,
      orderNumber: 'Default'
    }];
  }
  
  console.log('Extracted locations with segments:', sortedLocations.map(loc => ({ 
    address: loc.address, 
    polygonSegment: loc.polygonSegment 
  })));
  
  return sortedLocations;
};

// Export the GeoJSON data for reuse
export const segmentGeoJSON = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "segment": 1,
        "bearing_start": 0.0,
        "bearing_end": 45.0
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -1.8904,
              52.4862
            ],
            [
              -1.8904,
              55.18416481775619
            ],
            [
              1.3834377003453167,
              54.35034468072543
            ],
            [
              -1.8904,
              52.4862
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "segment": 2,
        "bearing_start": 45.0,
        "bearing_end": 90.0
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -1.8904,
              52.4862
            ],
            [
              1.3834377003453167,
              54.35034468072543
            ],
            [
              2.5345602214301945,
              52.403551499812956
            ],
            [
              -1.8904,
              52.4862
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "segment": 3,
        "bearing_start": 90.0,
        "bearing_end": 150.0
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -1.8904,
              52.4862
            ],
            [
              2.5345602214301945,
              52.403551499812956
            ],
            [
              0.5,
              50.2
            ],
            [
              -1.8904,
              52.4862
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "segment": 4,
        "bearing_start": 150.0,
        "bearing_end": 195.0
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -1.8904,
              52.4862
            ],
            [
              0.5,
              50.2
            ],
            [
              -2.5,
              49.5
            ],
            [
              -1.8904,
              52.4862
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "segment": 5,
        "bearing_start": 195.0,
        "bearing_end": 240.0
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -1.8904,
              52.4862
            ],
            [
              -2.5,
              49.5
            ],
            [
              -5.0,
              50.8
            ],
            [
              -1.8904,
              52.4862
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "segment": 6,
        "bearing_start": 225.0,
        "bearing_end": 270.0
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -1.8904,
              52.4862
            ],
            [
              -4.892389415721296,
              50.539143784097334
            ],
            [
              -6.315360221430195,
              52.403551499812956
            ],
            [
              -1.8904,
              52.4862
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "segment": 7,
        "bearing_start": 270.0,
        "bearing_end": 315.0
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -1.8904,
              52.4862
            ],
            [
              -6.315360221430195,
              52.403551499812956
            ],
            [
              -5.164237700345319,
              54.35034468072543
            ],
            [
              -1.8904,
              52.4862
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "segment": 8,
        "bearing_start": 315.0,
        "bearing_end": 360.0
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -1.8904,
              52.4862
            ],
            [
              -5.164237700345319,
              54.35034468072543
            ],
            [
              -1.8904000000000014,
              55.18416481775619
            ],
            [
              -1.8904,
              52.4862
            ]
          ]
        ]
      }
    }
  ]
};

// Define polygon style based on segment number
const getPolygonStyle = (feature: any) => {
  // Get the segment number from the properties
  const segment = feature.properties.segment;
  
  // Define colors for each segment that match the badge colors
  const segmentColors = {
    1: '#8B5CF6', // Vivid Purple (p1-segment)
    2: '#F97316', // Bright Orange (p2-segment)
    3: '#0EA5E9', // Ocean Blue (p3-segment)
    4: '#10B981', // Soft Green (p4-segment)
    5: '#F43F5E', // Soft Pink (p5-segment)
    6: '#14B8A6', // Teal (p6-segment)
    7: '#6366F1', // Indigo (p7-segment)
    8: '#EC4899'  // Pink (p8-segment)
  };
  
  // Use the segment number to get the color, or default to blue
  const color = segmentColors[segment as keyof typeof segmentColors] || '#3388ff';
  
  return {
    fillColor: color,
    fillOpacity: 0.2,
    color: color,
    weight: 2,
  };
};

const JobMap: React.FC<JobMapProps> = ({ orders = [] }) => {
  const mapRef = useRef<L.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const polygonLabelsRef = useRef<L.Marker[]>([]);
  
  // Clear existing polygon labels when component unmounts or map is reset
  const clearPolygonLabels = () => {
    if (mapRef.current) {
      polygonLabelsRef.current.forEach(marker => {
        marker.remove();
      });
      polygonLabelsRef.current = [];
    }
  };
  
  useEffect(() => {
    fixLeafletIcon();
    
    // Clean up function to remove markers when component unmounts
    return () => {
      clearPolygonLabels();
    };
  }, []);
  
  // Effect to handle map invalidation when orders change
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
    }
  }, [orders]);
  
  // Effect to add polygon labels once map is loaded
  useEffect(() => {
    if (mapLoaded && mapRef.current) {
      // Clear any existing polygon labels first
      clearPolygonLabels();
      
      // Add polygon labels
      segmentGeoJSON.features.forEach(feature => {
        const segmentNumber = feature.properties.segment;
        
        // Calculate the center point of the polygon
        const polygonCoords = feature.geometry.coordinates[0].map(
          coord => new L.LatLng(coord[1], coord[0])
        );
        const polygonLatLngs = L.latLngBounds(polygonCoords);
        const center = polygonLatLngs.getCenter();
        
        // Count jobs in this polygon
        const locations = extractLocations(orders);
        const jobsInPolygon = locations.filter(
          loc => loc.polygonSegment === segmentNumber
        ).length;
        
        // Create label for the polygon segment
        const icon = L.divIcon({
          className: 'polygon-label',
          html: `<div style="background: white; padding: 3px; border: 1px solid #666; border-radius: 3px; font-weight: bold;">
                  P${segmentNumber}<br/>(${jobsInPolygon} jobs)
                </div>`,
          iconSize: [60, 40],
          iconAnchor: [30, 20]
        });
        
        // Add marker to the map
        if (mapRef.current) {
          const marker = L.marker(center, { icon }).addTo(mapRef.current);
          polygonLabelsRef.current.push(marker);
        }
      });
    }
  }, [mapLoaded, orders]);
  
  const locations = extractLocations(orders);
  
  // Debug logging
  console.log('Orders with polygon segments:', orders.map(o => ({
    id: o.id,
    senderPolygonSegment: o.senderPolygonSegment,
    receiverPolygonSegment: o.receiverPolygonSegment
  })));
  
  let centerLat = 51.5074; // Default to London
  let centerLng = -0.1278;
  
  if (locations.length > 0) {
    centerLat = locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length;
    centerLng = locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length;
  }
  
  const collectionIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const deliveryIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  return (
    <div className="h-[400px] w-full mb-8 rounded-lg overflow-hidden border border-border" id="map-container">
      <MapContainer 
        center={[centerLat, centerLng]} 
        zoom={6} 
        style={{ height: '100%', width: '100%' }}
        whenCreated={(map) => {
          mapRef.current = map;
          setMapLoaded(true);
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
        {/* Add the GeoJSON polygons */}
        <GeoJSON 
          data={segmentGeoJSON}
          style={getPolygonStyle}
          onEachFeature={(feature, layer) => {
            const segmentNumber = feature.properties.segment;
            
            // Type casting the layer to access getBounds
            const polygonLayer = layer as L.Polygon;
            
            // Add popup with segment info
            const locations = extractLocations(orders);
            const jobsInPolygon = locations.filter(
              loc => loc.polygonSegment === segmentNumber
            ).length;
            
            layer.bindPopup(`<strong>Polygon ${segmentNumber}</strong><br>${jobsInPolygon} jobs in this area`);
          }}
        />
        
        {locations.map((loc, idx) => (
          <Marker 
            key={`${loc.type}-${loc.orderNumber}-${idx}`} 
            position={[loc.lat, loc.lng]}
            icon={loc.type === 'collection' ? collectionIcon : deliveryIcon}
          >
            <Popup>
              <div className="p-2">
                <p className="font-semibold">
                  {loc.type === 'collection' ? 'Collection Point' : 'Delivery Point'}
                  {loc.polygonSegment && ` (P${loc.polygonSegment})`}
                </p>
                <p className="text-sm text-muted-foreground">{loc.address}</p>
                <p className="text-xs text-muted-foreground mt-1">Order: {loc.orderNumber}</p>
                {loc.date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(loc.date, 'PPP')}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default JobMap;
