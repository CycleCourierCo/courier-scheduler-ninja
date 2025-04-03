
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
    
    // Create an object instead of Map to track events by title to prevent duplicates
    const eventMap = {};
    
    // Always include Shipday tracking events if available
    const shipdayUpdates = order.trackingEvents?.shipday?.updates || [];
    const pickupId = order.trackingEvents?.shipday?.pickup_id;
    const deliveryId = order.trackingEvents?.shipday?.delivery_id;
    
    // Flag to track if we've added critical tracking events from Shipday
    let hasDriverToCollectionEvent = false;
    let hasBikeCollectedEvent = false;
    let hasDriverToDeliveryEvent = false;
    let hasDeliveredEvent = false;
    
    if (shipdayUpdates.length > 0) {
      shipdayUpdates.forEach((update: ShipdayUpdate) => {
        // If the update has a description, use that directly
        if (update.description) {
          let title = "";
          let icon = <Truck className="h-4 w-4 text-courier-600" />;
          
          if (update.description.includes("way to collect")) {
            title = "Driver En Route to Collection";
            hasDriverToCollectionEvent = true;
            icon = <Map className="h-4 w-4 text-courier-600" />;
          } else if (update.description.includes("collected the bike")) {
            title = "Bike Collected";
            hasBikeCollectedEvent = true;
            icon = <Check className="h-4 w-4 text-courier-600" />;
          } else if (update.description.includes("way to deliver")) {
            title = "Driver En Route to Delivery";
            hasDriverToDeliveryEvent = true;
            icon = <Truck className="h-4 w-4 text-courier-600" />;
          } else if (update.description.includes("delivered the bike")) {
            title = "Delivered";
            hasDeliveredEvent = true;
            icon = <Check className="h-4 w-4 text-green-600" />;
          }
          
          // Only add if we have a title and it's not a duplicate
          if (title && !eventMap[title]) {
            const event = {
              title: title || "Status Update",
              date: new Date(update.timestamp),
              icon,
              description: update.description
            };
            events.push(event);
            eventMap[title] = event;
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
              hasDriverToCollectionEvent = true;
              icon = <Map className="h-4 w-4 text-courier-600" />;
              description = "Driver is on the way to collect the bike";
            } else if (statusLower === "picked-up" || statusLower === "delivered" || statusLower === "already_delivered") {
              // Handle both "picked-up" and "delivered" statuses for pickup
              title = "Bike Collected";
              hasBikeCollectedEvent = true;
              icon = <Check className="h-4 w-4 text-courier-600" />;
              description = "Bike has been collected from sender";
            }
          } else {
            if (statusLower === "on-the-way" || statusLower === "ready_to_deliver") {
              title = "Driver En Route to Delivery";
              hasDriverToDeliveryEvent = true;
              icon = <Truck className="h-4 w-4 text-courier-600" />;
              description = "Driver is on the way to deliver the bike";
            } else if (statusLower === "delivered" || statusLower === "already_delivered") {
              title = "Delivered";
              hasDeliveredEvent = true;
              icon = <Check className="h-4 w-4 text-green-600" />;
              description = "Bike has been delivered to receiver";
            }
          }
          
          // Only add if we have a title and it's not a duplicate
          if (title && !eventMap[title]) {
            const event = {
              title,
              date: new Date(update.timestamp),
              icon,
              description
            };
            events.push(event);
            eventMap[title] = event;
          }
        }
      });
    }
    
    // If no shipday updates are found but we have specific status, add fallback events
    if (shipdayUpdates.length === 0) {
      // Status-based fallback timeline events (important for customer visibility)
      if (order.status === "sender_availability_pending" && !eventMap["Awaiting Collection Dates"]) {
        const event = {
          title: "Awaiting Collection Dates",
          date: order.updatedAt || order.createdAt,
          icon: <Clock className="h-4 w-4 text-courier-600" />,
          description: "Waiting for sender to confirm availability dates"
        };
        events.push(event);
        eventMap["Awaiting Collection Dates"] = event;
      }
      
      if (order.status === "receiver_availability_pending" && !eventMap["Awaiting Delivery Dates"]) {
        const event = {
          title: "Awaiting Delivery Dates",
          date: order.updatedAt || order.createdAt,
          icon: <Clock className="h-4 w-4 text-courier-600" />,
          description: "Waiting for receiver to confirm availability dates"
        };
        events.push(event);
        eventMap["Awaiting Delivery Dates"] = event;
      }
      
      if (order.status === "scheduled_dates_pending" && !eventMap["Scheduling in Progress"]) {
        const event = {
          title: "Scheduling in Progress",
          date: order.updatedAt || order.createdAt,
          icon: <Calendar className="h-4 w-4 text-courier-600" />,
          description: "Transport team is scheduling your pickup and delivery"
        };
        events.push(event);
        eventMap["Scheduling in Progress"] = event;
      }
    }
    
    // Always add these critical steps if they're missing and the order has progressed to or past these stages
    // Driver to Collection - add if status indicates this happened but no event exists yet
    if (!hasDriverToCollectionEvent && 
        (order.status === "driver_to_collection" || 
         order.status === "collected" || 
         order.status === "driver_to_delivery" || 
         order.status === "shipped" || 
         order.status === "delivered")) {
      const event = {
        title: "Driver En Route to Collection",
        date: order.updatedAt,
        icon: <Map className="h-4 w-4 text-courier-600" />,
        description: "Driver is on the way to collect the bike"
      };
      events.push(event);
      eventMap["Driver En Route to Collection"] = event;
    }
    
    // Bike Collected - add if status indicates this happened but no event exists yet
    if (!hasBikeCollectedEvent && 
        (order.status === "collected" || 
         order.status === "driver_to_delivery" || 
         order.status === "shipped" || 
         order.status === "delivered")) {
      const event = {
        title: "Bike Collected",
        date: order.updatedAt,
        icon: <Check className="h-4 w-4 text-courier-600" />,
        description: "Bike has been collected from sender"
      };
      events.push(event);
      eventMap["Bike Collected"] = event;
    }
    
    // Driver to Delivery - add if status indicates this happened but no event exists yet
    if (!hasDriverToDeliveryEvent && 
        (order.status === "driver_to_delivery" || 
         order.status === "shipped" || 
         order.status === "delivered")) {
      const event = {
        title: "Driver En Route to Delivery",
        date: order.updatedAt,
        icon: <Truck className="h-4 w-4 text-courier-600" />,
        description: "Driver is on the way to deliver the bike"
      };
      events.push(event);
      eventMap["Driver En Route to Delivery"] = event;
    }
    
    // In Transit - add for shipped status if not already present
    if (order.status === "shipped" && !eventMap["In Transit"]) {
      const event = {
        title: "In Transit",
        date: order.updatedAt,
        icon: <Truck className="h-4 w-4 text-courier-600" />,
        description: "Bike is in transit"
      };
      events.push(event);
      eventMap["In Transit"] = event;
    }
    
    // Delivered - add if status indicates this happened but no event exists yet
    if (!hasDeliveredEvent && order.status === "delivered") {
      const event = {
        title: "Delivered",
        date: order.updatedAt,
        icon: <Check className="h-4 w-4 text-green-600" />,
        description: "Bike has been delivered to receiver"
      };
      events.push(event);
      eventMap["Delivered"] = event;
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
