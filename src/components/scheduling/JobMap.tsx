
import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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

// Function to check if a point is inside a polygon
const isPointInPolygon = (point: [number, number], polygon: number[][]) => {
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

// Function to determine which polygon a location belongs to
const getPolygonSegment = (lat: number, lng: number): number | null => {
  for (let i = 0; i < segmentGeoJSON.features.length; i++) {
    const polygon = segmentGeoJSON.features[i].geometry.coordinates[0];
    if (isPointInPolygon([lng, lat], polygon)) {
      return i + 1;
    }
  }
  return null;
};

// Extract locations function updated to include polygon segment
const extractLocations = (orders: OrderData[] = []) => {
  const locations: { 
    address: string; 
    lat: number; 
    lng: number;
    type: 'collection' | 'delivery';
    orderNumber: string;
    date?: Date;
    polygonSegment?: number;  // Add polygon segment
  }[] = [];
  
  console.log(`Extracting locations from ${orders.length} orders`);
  
  orders.forEach(order => {
    if (order.sender.address.lat && order.sender.address.lon) {
      const polygonSegment = getPolygonSegment(
        order.sender.address.lat,
        order.sender.address.lon
      );
      
      // Store the polygon segment in the order object for later reference
      if (polygonSegment !== null) {
        order.polygonSegment = polygonSegment;
      }
      
      locations.push({
        address: `${order.sender.address.street}, ${order.sender.address.city}`,
        lat: order.sender.address.lat,
        lng: order.sender.address.lon,
        type: 'collection',
        orderNumber: order.tracking_number || 'No tracking number',
        date: order.scheduled_pickup_date ? new Date(order.scheduled_pickup_date) : undefined,
        polygonSegment
      });
    }
    
    if (order.receiver.address.lat && order.receiver.address.lon) {
      const polygonSegment = getPolygonSegment(
        order.receiver.address.lat,
        order.receiver.address.lon
      );
      
      // Store the polygon segment in the order object for later reference
      if (polygonSegment !== null) {
        order.polygonSegment = polygonSegment;
      }
      
      locations.push({
        address: `${order.receiver.address.street}, ${order.receiver.address.city}`,
        lat: order.receiver.address.lat,
        lng: order.receiver.address.lon,
        type: 'delivery',
        orderNumber: order.tracking_number || 'No tracking number',
        date: order.scheduled_delivery_date ? new Date(order.scheduled_delivery_date) : undefined,
        polygonSegment
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
  
  return sortedLocations;
};

const segmentGeoJSON = {
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
        "bearing_end": 135.0
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
              1.1115894157212958,
              50.539143784097334
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
        "bearing_start": 135.0,
        "bearing_end": 180.0
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
              1.1115894157212958,
              50.539143784097334
            ],
            [
              -1.8903999999999999,
              49.78823518224381
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
        "bearing_start": 180.0,
        "bearing_end": 225.0
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
              -1.8903999999999999,
              49.78823518224381
            ],
            [
              -4.892389415721296,
              50.539143784097334
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

const getPolygonStyle = (feature: any) => {
  return {
    fillColor: '#3388ff',
    fillOpacity: 0.2,
    color: '#3388ff',
    weight: 2,
  };
};

const JobMap: React.FC<JobMapProps> = ({ orders = [] }) => {
  const mapRef = useRef<L.Map | null>(null);
  
  useEffect(() => {
    fixLeafletIcon();
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
    }
  }, [orders]);
  
  const locations = extractLocations(orders);
  
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

  // Create a GeoJSON layer with labels
  useEffect(() => {
    if (mapRef.current) {
      // Clear existing GeoJSON layers
      mapRef.current.eachLayer((layer) => {
        if (layer instanceof L.GeoJSON) {
          mapRef.current?.removeLayer(layer);
        }
      });

      // Add new GeoJSON layer with labels
      const geoJsonLayer = L.geoJSON(segmentGeoJSON as any, {
        style: getPolygonStyle,
        onEachFeature: (feature, layer) => {
          const segmentNumber = feature.properties.segment;
          
          // Type casting the layer to access getBounds
          const polygonLayer = layer as L.Polygon;
          const center = polygonLayer.getBounds().getCenter();
          
          // Count jobs in this polygon
          const jobsInPolygon = locations.filter(
            loc => loc.polygonSegment === segmentNumber
          ).length;
          
          // Add a label with polygon number and job count
          L.marker(center, {
            icon: L.divIcon({
              className: 'polygon-label',
              html: `<div style="background: white; padding: 3px; border: 1px solid #666; border-radius: 3px;">
                      P${segmentNumber}<br/>(${jobsInPolygon} jobs)
                    </div>`,
              iconSize: [40, 40],
              iconAnchor: [20, 20]
            })
          }).addTo(mapRef.current!);
        }
      }).addTo(mapRef.current);
    }
  }, [locations, mapRef.current]);

  return (
    <div className="h-[400px] w-full mb-8 rounded-lg overflow-hidden border border-border" id="map-container">
      <MapContainer 
        center={[centerLat, centerLng]} 
        zoom={6} 
        style={{ height: '100%', width: '100%' }}
        whenCreated={(map) => {
          mapRef.current = map;
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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
