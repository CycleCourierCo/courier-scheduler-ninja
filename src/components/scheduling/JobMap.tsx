
import React from 'react';
import { MapContainer as LeafletMapContainer, TileLayer } from 'react-leaflet';
import { Card, CardContent } from '../ui/card';
import 'leaflet/dist/leaflet.css';

const JobMap = () => {
  const position: [number, number] = [51.505, -0.09]; // London coordinates as default

  return (
    <Card className="h-[600px] mb-8">
      <CardContent className="p-0">
        <LeafletMapContainer
          center={position}
          zoom={13}
          scrollWheelZoom={false}
          className="h-full w-full rounded-lg"
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LeafletMapContainer>
      </CardContent>
    </Card>
  );
};

export default JobMap;

