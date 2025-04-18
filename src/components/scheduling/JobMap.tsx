
import React from 'react';
import { MapContainer, TileLayer, Popup, Marker } from 'react-leaflet';
import { Card, CardContent } from '../ui/card';
import 'leaflet/dist/leaflet.css';
import { OrderData } from '@/pages/JobScheduling';
import { divIcon } from 'leaflet';

// Define props interface for JobMap
interface JobMapProps {
  orders?: OrderData[];
}

const JobMap: React.FC<JobMapProps> = ({ orders = [] }) => {
  // London coordinates as default
  const defaultPosition: [number, number] = [51.505, -0.09];

  return (
    <Card className="h-[600px] mb-8">
      <CardContent className="p-0">
        <MapContainer
          center={defaultPosition}
          zoom={13}
          scrollWheelZoom={false}
          className="h-full w-full rounded-lg"
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* We'll add markers for orders here in the future */}
        </MapContainer>
      </CardContent>
    </Card>
  );
};

export default JobMap;
