
import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { OrderData } from '@/pages/JobScheduling';
import 'leaflet/dist/leaflet.css';

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

// Extract all collection and delivery locations from orders
const extractLocations = (orders: OrderData[] = []) => {
  const locations: { 
    address: string; 
    lat: number; 
    lng: number;
    type: 'collection' | 'delivery';
    orderNumber: string;
  }[] = [];
  
  orders.forEach(order => {
    // Add collection point
    if (order.sender.address.lat && order.sender.address.lon) {
      locations.push({
        address: `${order.sender.address.street}, ${order.sender.address.city}`,
        lat: order.sender.address.lat,
        lng: order.sender.address.lon,
        type: 'collection',
        orderNumber: order.tracking_number || 'No tracking number'
      });
    }
    
    // Add delivery point
    if (order.receiver.address.lat && order.receiver.address.lon) {
      locations.push({
        address: `${order.receiver.address.street}, ${order.receiver.address.city}`,
        lat: order.receiver.address.lat,
        lng: order.receiver.address.lon,
        type: 'delivery',
        orderNumber: order.tracking_number || 'No tracking number'
      });
    }
  });
  
  // If no locations found, use default location
  if (locations.length === 0) {
    return [{
      address: 'London',
      lat: 51.5074,
      lng: -0.1278,
      type: 'collection' as const,
      orderNumber: 'Default'
    }];
  }
  
  return locations;
};

const JobMap: React.FC<JobMapProps> = ({ orders = [] }) => {
  const mapRef = useRef<L.Map | null>(null);
  
  useEffect(() => {
    fixLeafletIcon();
    
    // Ensure map is rendered within bounds
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
    }
  }, []);
  
  const locations = extractLocations(orders);
  const centerLat = locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length;
  const centerLng = locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length;
  
  // Create custom icons for collection and delivery
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
        center={[centerLat || 52.4862, centerLng || -1.8904]} 
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
            key={`${loc.type}-${idx}`} 
            position={[loc.lat, loc.lng]}
            icon={loc.type === 'collection' ? collectionIcon : deliveryIcon}
          >
            <Popup>
              <div className="p-2">
                <p className="font-semibold">{loc.type === 'collection' ? 'Collection Point' : 'Delivery Point'}</p>
                <p className="text-sm text-muted-foreground">{loc.address}</p>
                <p className="text-xs text-muted-foreground mt-1">Order: {loc.orderNumber}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default JobMap;
