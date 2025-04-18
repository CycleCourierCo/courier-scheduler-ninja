
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Popup, Marker } from 'react-leaflet';
import { Card, CardContent } from '../ui/card';
import 'leaflet/dist/leaflet.css';
import { OrderData } from '@/pages/JobScheduling';
import L from 'leaflet';

// Define props interface for JobMap
interface JobMapProps {
  orders?: OrderData[];
}

const JobMap: React.FC<JobMapProps> = ({ orders = [] }) => {
  // London coordinates as default
  const defaultPosition: [number, number] = [51.505, -0.09];

  // Fix Leaflet's default icon issue
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });
  }, []);

  return (
    <Card className="h-[600px] mb-8">
      <CardContent className="p-0">
        <div id="map-container" className="h-full w-full rounded-lg">
          <MapContainer
            center={defaultPosition}
            zoom={13}
            scrollWheelZoom={false}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* We'll add markers for orders here in the future */}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default JobMap;
