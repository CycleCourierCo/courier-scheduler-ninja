import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { JobLocation } from '@/types/timeslip';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const deliveryIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface TimeslipMapPreviewProps {
  locations: JobLocation[];
  height?: string;
}

const TimeslipMapPreview: React.FC<TimeslipMapPreviewProps> = ({ 
  locations,
  height = "400px" 
}) => {
  const mapRef = useRef<L.Map | null>(null);

  // Calculate center point
  const center: [number, number] = locations.length > 0
    ? [
        locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length,
        locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length
      ]
    : [52.4707965, -1.8749747]; // Default to depot

  useEffect(() => {
    if (mapRef.current && locations.length > 0) {
      const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lng]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations]);

  if (locations.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-muted rounded-lg" 
        style={{ height }}
      >
        <p className="text-muted-foreground">No locations to display</p>
      </div>
    );
  }

  return (
    <MapContainer
      center={center}
      zoom={10}
      style={{ height, width: '100%' }}
      className="rounded-lg"
      whenCreated={(map) => {
        mapRef.current = map;
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Markers for each location */}
      {locations.map((location, index) => (
        <Marker
          key={`${location.order_id}-${index}`}
          position={[location.lat, location.lng]}
          icon={location.type === 'pickup' ? pickupIcon : deliveryIcon}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">
                {location.type === 'pickup' ? '🟢 Pickup' : '🔴 Delivery'}
              </p>
              {location.postcode && <p>Postcode: {location.postcode}</p>}
              <p className="text-xs text-muted-foreground">
                Order: {location.order_id.slice(0, 8)}...
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default TimeslipMapPreview;
