
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Card, CardContent } from '../ui/card';
import { Address } from '@/types/order';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { format } from 'date-fns';

// Fix for the default marker icon issue in React-Leaflet
// Create custom icons for collection and delivery
const collectionIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const deliveryIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Format address function to avoid importing from locationUtils
const formatAddress = (address: Address): string => {
  return `${address.street}, ${address.city}, ${address.state} ${address.zipCode}, ${address.country}`;
};

// Define the OrderData interface here rather than importing it
interface OrderData {
  id: string;
  status: string;
  tracking_number: string;
  bike_brand: string | null;
  bike_model: string | null;
  created_at: string;
  sender: { name: string; email: string; phone: string; address: Address };
  receiver: { name: string; email: string; phone: string; address: Address };
  scheduled_pickup_date: string | null;
  scheduled_delivery_date: string | null;
  pickup_date: string[] | null;
  delivery_date: string[] | null;
}

interface JobMapProps {
  orders: OrderData[];
}

// Create a MapBounds component to handle the bounds fitting
const MapBounds: React.FC<{ orders: OrderData[] }> = ({ orders }) => {
  const map = useMap();
  
  useEffect(() => {
    if (orders.length > 0) {
      const bounds: L.LatLngBoundsExpression = [];
      
      orders.forEach(order => {
        if (order.sender.address.lat && order.sender.address.lon) {
          bounds.push([order.sender.address.lat, order.sender.address.lon]);
        }
        if (order.receiver.address.lat && order.receiver.address.lon) {
          bounds.push([order.receiver.address.lat, order.receiver.address.lon]);
        }
      });
      
      if (bounds.length > 0) {
        map.fitBounds(bounds);
      }
    }
  }, [orders, map]);
  
  return null;
};

const JobMap: React.FC<JobMapProps> = ({ orders }) => {
  // Default center (will be adjusted by MapBounds)
  const defaultCenter: [number, number] = [51.505, -0.09];
  
  return (
    <Card className="h-[600px] mb-8">
      <CardContent className="p-0">
        <MapContainer
          center={defaultCenter}
          zoom={11}
          className="h-full w-full rounded-lg"
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBounds orders={orders} />
          {orders.map((order) => (
            <React.Fragment key={order.id}>
              {order.sender.address.lat && order.sender.address.lon && (
                <Marker
                  position={[order.sender.address.lat, order.sender.address.lon] as [number, number]}
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
                  position={[order.receiver.address.lat, order.receiver.address.lon] as [number, number]}
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
