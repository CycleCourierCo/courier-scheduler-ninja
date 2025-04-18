
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

// Extract locations from sender and receiver addresses
const extractLocations = (orders: OrderData[] = []) => {
  const locations: { address: string; lat: number; lng: number }[] = [];
  
  orders.forEach(order => {
    if (order.sender.address.lat && order.sender.address.lon) {
      locations.push({
        address: `${order.sender.address.street}, ${order.sender.address.city}`,
        lat: order.sender.address.lat,
        lng: order.sender.address.lon
      });
    }
    
    if (order.receiver.address.lat && order.receiver.address.lon) {
      locations.push({
        address: `${order.receiver.address.street}, ${order.receiver.address.city}`,
        lat: order.receiver.address.lat,
        lng: order.receiver.address.lon
      });
    }
  });
  
  // If no locations found, use default locations
  if (locations.length === 0) {
    return [
      { address: 'London', lat: 51.5074, lng: -0.1278 },
      { address: 'Birmingham', lat: 52.4862, lng: -1.8904 },
    ];
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
          <Marker key={idx} position={[loc.lat, loc.lng]}>
            <Popup>{loc.address}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default JobMap;
