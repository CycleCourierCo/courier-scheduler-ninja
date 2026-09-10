import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { JobLocation } from '@/types/timeslip';
import 'leaflet/dist/leaflet.css';
import { applyDefaultMarkerIcons, colouredMarkerIcon } from '@/lib/mapMarkers';

// Bundled marker images — external pin hosts are blocked on some networks
applyDefaultMarkerIcons();

const pickupIcon = colouredMarkerIcon('green');
const deliveryIcon = colouredMarkerIcon('red');

interface TimeslipMapPreviewProps {
  locations: JobLocation[];
  height?: string;
}


const TimeslipMapPreview: React.FC<TimeslipMapPreviewProps> = ({ 
  locations,
  height = "400px" 
}) => {
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (mapRef.current && locations.length > 0) {
      const bounds = L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng] as [number, number]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations]);

  // Calculate center point
  const center: [number, number] = locations.length > 0
    ? [
        locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length,
        locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length
      ]
    : [52.4707965, -1.8749747]; // Default to depot

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
      // Cast: the installed react-leaflet forwards a ref to the Leaflet map,
      // but the ambient types in this project predate that.
      {...({ ref: mapRef } as Record<string, unknown>)}
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
