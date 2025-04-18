import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

type Location = {
  address: string;
  lat: number;
  lng: number;
};

const locations: Location[] = [
  { address: 'London', lat: 51.5074, lng: -0.1278 },
  { address: 'Birmingham', lat: 52.4862, lng: -1.8904 },
];

const MapComponent = () => {
  return (
    <MapContainer center={[52.4862, -1.8904]} zoom={6} style={{ height: '500px', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locations.map((loc, idx) => (
        <Marker key={idx} position={[loc.lat, loc.lng]}>
          <Popup>{loc.address}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default MapComponent;
