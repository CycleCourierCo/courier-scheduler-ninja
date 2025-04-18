
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { OrderData } from '@/pages/JobScheduling';
import { Card, CardContent } from '../ui/card';
import { formatAddress } from '@/utils/locationUtils';
import 'leaflet/dist/leaflet.css';
import { Icon } from 'leaflet';
import { format } from 'date-fns';

// Fix for the default marker icon issue in React-Leaflet
// Create custom icons for collection and delivery
const collectionIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const deliveryIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface JobMapProps {
  orders: OrderData[];
}

const JobMap: React.FC<JobMapProps> = ({ orders }) => {
  // Calculate center based on all markers or default to London
  const defaultCenter = { lat: 51.505, lng: -0.09 };
  
  return (
    <Card className="h-[600px] mb-8">
      <CardContent className="p-0">
        <MapContainer
          center={defaultCenter}
          zoom={11}
          className="h-full w-full rounded-lg"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {orders.map((order) => (
            <React.Fragment key={order.id}>
              {order.sender.address.lat && order.sender.address.lon && (
                <Marker
                  position={[order.sender.address.lat, order.sender.address.lon]}
                  icon={collectionIcon}
                >
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-semibold mb-2">Collection Point</h3>
                      <p className="text-sm mb-1">Order #{order.tracking_number}</p>
                      <p className="text-sm mb-1">{order.sender.name}</p>
                      <p className="text-sm mb-2">{formatAddress(order.sender.address)}</p>
                      {order.scheduled_pickup_date && (
                        <p className="text-sm text-green-600">
                          Scheduled: {format(new Date(order.scheduled_pickup_date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )}
              {order.receiver.address.lat && order.receiver.address.lon && (
                <Marker
                  position={[order.receiver.address.lat, order.receiver.address.lon]}
                  icon={deliveryIcon}
                >
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-semibold mb-2">Delivery Point</h3>
                      <p className="text-sm mb-1">Order #{order.tracking_number}</p>
                      <p className="text-sm mb-1">{order.receiver.name}</p>
                      <p className="text-sm mb-2">{formatAddress(order.receiver.address)}</p>
                      {order.scheduled_delivery_date && (
                        <p className="text-sm text-blue-600">
                          Scheduled: {format(new Date(order.scheduled_delivery_date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )}
            </React.Fragment>
          ))}
        </MapContainer>
      </CardContent>
    </Card>
  );
};

export default JobMap;
