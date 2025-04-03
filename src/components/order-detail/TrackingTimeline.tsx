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
    const eventMap = {};

    // Add the creation event using order.createdAt
    events.push({
      title: "Order Created",
      date: order.createdAt,
      icon: <Package className="h-4 w-4 text-courier-600" />,
      description: order.trackingNumber
        ? `Order created with tracking number: ${order.trackingNumber}`
        : "Order created successfully",
    });
    eventMap["Order Created"] = events[0];

    // Add confirmation events with their original timestamps
    if (order.senderConfirmedAt) {
      const event = {
        title: "Collection Dates Chosen",
        date: order.senderConfirmedAt,
        icon: <ClipboardEdit className="h-4 w-4 text-courier-600" />,
        description: "Collection dates have been confirmed",
      };
      events.push(event);
      eventMap["Collection Dates Chosen"] = event;
    }

    if (order.receiverConfirmedAt) {
      const event = {
        title: "Delivery Dates Chosen",
        date: order.receiverConfirmedAt,
        icon: <ClipboardEdit className="h-4 w-4 text-courier-600" />,
        description: "Delivery dates have been confirmed",
      };
      events.push(event);
      eventMap["Delivery Dates Chosen"] = event;
    }

    if (order.scheduledAt) {
      const event = {
        title: "Transport Scheduled",
        date: order.scheduledAt,
        icon: <Calendar className="h-4 w-4 text-courier-600" />,
        description: "Transport manager has scheduled pickup and delivery",
      };
      events.push(event);
      eventMap["Transport Scheduled"] = event;
    }

    // Process Shipday tracking events
    const shipdayUpdates = order.trackingEvents?.shipday?.updates || [];
    const pickupId = order.trackingEvents?.shipday?.pickup_id;
    const deliveryId = order.trackingEvents?.shipday?.delivery_id;

    if (shipdayUpdates.length > 0) {
      // Sort updates chronologically
      const sortedUpdates = [...shipdayUpdates].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      sortedUpdates.forEach((update: ShipdayUpdate) => {
        let title = "";
        let icon = <Truck className="h-4 w-4 text-courier-600" />;
        let description = update.description;

        // Handle updates with descriptions first
        if (update.description) {
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
        } else {
          // Legacy handling for updates without description
          const isPickup = update.orderId === pickupId;
          const statusLower = update.status.toLowerCase();

          if (isPickup) {
            if (statusLower === "on-the-way" || statusLower === "ready_to_deliver") {
              title = "Driver En Route to Collection";
              icon = <Map className="h-4 w-4 text-courier-600" />;
              description = "Driver is on the way to collect the bike";
            } else if (
              statusLower === "picked-up" ||
              statusLower === "delivered" ||
              statusLower === "already_delivered"
            ) {
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
        }

        // Only add if we have a title and it's either new or a newer timestamp
        if (title && (!eventMap[title] || new Date(update.timestamp).getTime() > new Date(eventMap[title].date).getTime())) {
          const event = {
            title,
            date: new Date(update.timestamp),
            icon,
            description,
          };

          if (!eventMap[title]) {
            events.push(event);
          } else {
            const index = events.findIndex((e) => e.title === title);
            if (index !== -1) {
              events[index] = event;
            }
          }
          eventMap[title] = event;
        }
      });
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
              <div className="absolute top-1 left-0 rounded-full bg-white">{event.icon}</div>
              <div>
                <p className="font-medium text-gray-800">{event.title}</p>
                <p className="text-sm text-gray-500">{format(new Date(event.date), "PPP 'at' p")}</p>
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
