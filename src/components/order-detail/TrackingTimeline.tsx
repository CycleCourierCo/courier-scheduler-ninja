
import React from "react";
import { format } from "date-fns";
import { Order } from "@/types/order";
import { Package, ClipboardEdit, Calendar, Truck, Check, Clock, MapPin, Map, Bike } from "lucide-react";

interface TrackingTimelineProps {
  order: Order;
}

// Define the expected structure of a Shipday update
interface ShipdayUpdate {
  status: string;
  timestamp: string;
  orderId: string;
  description?: string;
  event?: string;
}

const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ order }) => {
  const getTrackingEvents = () => {
    const events = [];
    
    events.push({
      title: "Order Created",
      date: order.createdAt,
      icon: <Package className="h-4 w-4 text-courier-600" />,
      description: order.trackingNumber ? 
        `Order created with tracking number: ${order.trackingNumber}` : 
        "Order created successfully"
    });
    
    if (order.senderConfirmedAt) {
      events.push({
        title: "Collection Dates Chosen",
        date: order.senderConfirmedAt,
        icon: <ClipboardEdit className="h-4 w-4 text-courier-600" />,
        description: "Collection dates have been confirmed"
      });
    }
    
    if (order.receiverConfirmedAt) {
      events.push({
        title: "Delivery Dates Chosen",
        date: order.receiverConfirmedAt,
        icon: <ClipboardEdit className="h-4 w-4 text-courier-600" />,
        description: "Delivery dates have been confirmed"
      });
    }
    
    if (order.scheduledAt) {
      events.push({
        title: "Transport Scheduled",
        date: order.scheduledAt,
        icon: <Calendar className="h-4 w-4 text-courier-600" />,
        description: "Transport manager has scheduled pickup and delivery"
      });
    }
    
    // Add Shipday tracking events if available
    const shipdayUpdates = order.trackingEvents?.shipday?.updates || [];
    const pickupId = order.trackingEvents?.shipday?.pickup_id;
    const deliveryId = order.trackingEvents?.shipday?.delivery_id;
    
    if (shipdayUpdates.length > 0) {
      shipdayUpdates.forEach((update: ShipdayUpdate) => {
        // If the update has a description, use that directly
        if (update.description) {
          let title = "";
          let icon = <Truck className="h-4 w-4 text-courier-600" />;
          
          if (update.description.includes("way to collect")) {
            title = "Driver En Route to Collection";
            icon = <Map className="h-4 w-4 text-courier-600" />;
          } else if (update.description.includes("collected the bike")) {
            title = "Bike Collected";
            icon = <Check className="h-4 w-4 text-courier-600" />;
          } else if (update.description.includes("way to deliver")) {
            title = "Driver En Route to Delivery";
            icon = <Truck className="h-4 w-4 text-courier-600" />;
          } else if (update.description.includes("delivered the bike")) {
            title = "Delivered";
            icon = <Check className="h-4 w-4 text-green-600" />;
          }
          
          events.push({
            title: title || "Status Update",
            date: new Date(update.timestamp),
            icon,
            description: update.description
          });
        } else {
          // Legacy handling for updates without description
          const isPickup = update.orderId === pickupId;
          const statusLower = update.status.toLowerCase();
          
          let title = "";
          let icon = <Truck className="h-4 w-4 text-courier-600" />;
          let description = "";
          
          if (isPickup) {
            if (statusLower === "on-the-way" || statusLower === "ready_to_deliver") {
              title = "Driver En Route to Collection";
              icon = <Map className="h-4 w-4 text-courier-600" />;
              description = "Driver is on the way to collect the bike";
            } else if (statusLower === "picked-up" || statusLower === "delivered" || statusLower === "already_delivered") {
              // Handle both "picked-up" and "delivered" statuses for pickup
              title = "Bike Collected";
              icon = <Check className="h-4 w-4 text-courier-600" />;
              description = "Bike has been collected from sender";
            }
          } else {
            if (statusLower === "on-the-way" || statusLower === "ready_to_deliver") {
              title = "Driver En Route to Delivery";
              icon = <Truck className="h-4 w-4 text-courier-600" />;
              description = "Driver is on the way to deliver the bike";
            } else if (statusLower === "delivered" || statusLower === "already_delivered") {
              title = "Delivered";
              icon = <Check className="h-4 w-4 text-green-600" />;
              description = "Bike has been delivered to receiver";
            }
          }
          
          if (title) {
            events.push({
              title,
              date: new Date(update.timestamp),
              icon,
              description
            });
          }
        }
      });
    } else {
      // Fall back to order status if no Shipday updates
      if (order.status === "driver_to_collection") {
        events.push({
          title: "Driver En Route to Collection",
          date: order.updatedAt,
          icon: <Map className="h-4 w-4 text-courier-600" />,
          description: "Driver is on the way to collect the bike"
        });
      }
      
      if (order.status === "collected") {
        events.push({
          title: "Bike Collected",
          date: order.updatedAt,
          icon: <MapPin className="h-4 w-4 text-courier-600" />,
          description: "Bike has been collected from sender"
        });
      }
      
      if (order.status === "driver_to_delivery") {
        events.push({
          title: "Driver En Route to Delivery",
          date: order.updatedAt,
          icon: <Truck className="h-4 w-4 text-courier-600" />,
          description: "Driver is on the way to deliver the bike"
        });
      }
      
      if (order.status === "shipped") {
        events.push({
          title: "In Transit",
          date: order.updatedAt,
          icon: <Truck className="h-4 w-4 text-courier-600" />,
          description: "Bike is in transit"
        });
      }
      
      if (order.status === "delivered") {
        events.push({
          title: "Delivered",
          date: order.updatedAt,
          icon: <Check className="h-4 w-4 text-green-600" />,
          description: "Bike has been delivered"
        });
      }
    }
    
    // Sort events by date
    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const trackingEvents = getTrackingEvents();

  return (
    <div>
      <div className="flex items-center space-x-2">
        <Truck className="text-courier-600" />
        <h3 className="font-semibold">Tracking Details</h3>
      </div>
      
      {trackingEvents.length > 0 ? (
        <div className="space-y-3 mt-4">
          {trackingEvents.map((event, index) => (
            <div key={index} className="relative pl-6 pb-3">
              {index < trackingEvents.length - 1 && (
                <div className="absolute top-2 left-[7px] h-full w-0.5 bg-gray-200" />
              )}
              <div className="absolute top-1 left-0 rounded-full bg-white">
                {event.icon}
              </div>
              <div>
                <p className="font-medium text-gray-800">{event.title}</p>
                <p className="text-sm text-gray-500">
                  {format(new Date(event.date), "PPP 'at' p")}
                </p>
                <p className="text-sm">{event.description}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center space-x-2 text-gray-500 mt-4">
          <Clock className="h-4 w-4" />
          <p>Waiting for the first update</p>
        </div>
      )}
    </div>
  );
};

export default TrackingTimeline;
