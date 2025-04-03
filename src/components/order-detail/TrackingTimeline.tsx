
import React from "react";
import { format } from "date-fns";
import { Order, ShipdayUpdate } from "@/types/order";
import { Package, ClipboardEdit, Calendar, Truck, Check, Clock, MapPin, Map, Bike } from "lucide-react";

interface TrackingTimelineProps {
  order: Order;
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
    
    // Create a map to track events by title to prevent duplicates
    const eventMap = new Map();
    
    // Always include Shipday tracking events if available
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
          
          // Only add if we have a title and it's not a duplicate
          if (title && !eventMap.has(title)) {
            const event = {
              title: title || "Status Update",
              date: new Date(update.timestamp),
              icon,
              description: update.description
            };
            events.push(event);
            eventMap.set(title, event);
          }
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
          
          // Only add if we have a title and it's not a duplicate
          if (title && !eventMap.has(title)) {
            const event = {
              title,
              date: new Date(update.timestamp),
              icon,
              description
            };
            events.push(event);
            eventMap.set(title, event);
          }
        }
      });
    }
    
    // If no shipday updates are found but we have specific status, add fallback events
    if (shipdayUpdates.length === 0) {
      // Status-based fallback timeline events (important for customer visibility)
      if (order.status === "sender_availability_pending" && !eventMap.has("Awaiting Collection Dates")) {
        const event = {
          title: "Awaiting Collection Dates",
          date: order.updatedAt || order.createdAt,
          icon: <Clock className="h-4 w-4 text-courier-600" />,
          description: "Waiting for sender to confirm availability dates"
        };
        events.push(event);
        eventMap.set("Awaiting Collection Dates", event);
      }
      
      if (order.status === "receiver_availability_pending" && !eventMap.has("Awaiting Delivery Dates")) {
        const event = {
          title: "Awaiting Delivery Dates",
          date: order.updatedAt || order.createdAt,
          icon: <Clock className="h-4 w-4 text-courier-600" />,
          description: "Waiting for receiver to confirm availability dates"
        };
        events.push(event);
        eventMap.set("Awaiting Delivery Dates", event);
      }
      
      if (order.status === "scheduled_dates_pending" && !eventMap.has("Scheduling in Progress")) {
        const event = {
          title: "Scheduling in Progress",
          date: order.updatedAt || order.createdAt,
          icon: <Calendar className="h-4 w-4 text-courier-600" />,
          description: "Transport team is scheduling your pickup and delivery"
        };
        events.push(event);
        eventMap.set("Scheduling in Progress", event);
      }
    }
    
    // Add these status-based events regardless of Shipday updates
    // This ensures the collection steps remain visible even during delivery
    if (order.status === "driver_to_collection" && !eventMap.has("Driver En Route to Collection")) {
      const event = {
        title: "Driver En Route to Collection",
        date: order.updatedAt,
        icon: <Map className="h-4 w-4 text-courier-600" />,
        description: "Driver is on the way to collect the bike"
      };
      events.push(event);
      eventMap.set("Driver En Route to Collection", event);
    }
    
    if ((order.status === "collected" || order.status === "driver_to_delivery" || order.status === "shipped" || order.status === "delivered") && 
        !eventMap.has("Bike Collected")) {
      const event = {
        title: "Bike Collected",
        date: order.updatedAt,
        icon: <MapPin className="h-4 w-4 text-courier-600" />,
        description: "Bike has been collected from sender"
      };
      events.push(event);
      eventMap.set("Bike Collected", event);
    }
    
    if (order.status === "driver_to_delivery" && !eventMap.has("Driver En Route to Delivery")) {
      const event = {
        title: "Driver En Route to Delivery",
        date: order.updatedAt,
        icon: <Truck className="h-4 w-4 text-courier-600" />,
        description: "Driver is on the way to deliver the bike"
      };
      events.push(event);
      eventMap.set("Driver En Route to Delivery", event);
    }
    
    if (order.status === "shipped" && !eventMap.has("In Transit")) {
      const event = {
        title: "In Transit",
        date: order.updatedAt,
        icon: <Truck className="h-4 w-4 text-courier-600" />,
        description: "Bike is in transit"
      };
      events.push(event);
      eventMap.set("In Transit", event);
    }
    
    if (order.status === "delivered" && !eventMap.has("Delivered")) {
      const event = {
        title: "Delivered",
        date: order.updatedAt,
        icon: <Check className="h-4 w-4 text-green-600" />,
        description: "Bike has been delivered to receiver"
      };
      events.push(event);
      eventMap.set("Delivered", event);
    }
    
    // Sort events by date
    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const trackingEvents = getTrackingEvents();

  // For debugging
  console.log("Order tracking events:", order.trackingEvents?.shipday);
  console.log("Processed timeline events:", trackingEvents);

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
