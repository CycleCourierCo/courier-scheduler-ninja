import React from "react";
import { format } from "date-fns";
import { Order, ShipdayUpdate } from "@/types/order";
import { Package, ClipboardEdit, Calendar, Truck, Check, Clock, Map } from "lucide-react";

interface TrackingTimelineProps {
  order: Order;
}

const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ order }) => {
  const getTrackingEvents = () => {
    const events = [];
    const eventMap: Record<string, any> = {};

    events.push({
      title: "Order Created",
      date: order.createdAt,
      icon: <Package className="h-4 w-4 text-courier-600" />,
      description: order.trackingNumber
        ? `Order created with tracking number: ${order.trackingNumber}`
        : "Order created successfully",
    });
    eventMap["Order Created"] = events[0];

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

    const shipdayUpdates = order.trackingEvents?.shipday?.updates || [];
    const pickupId = order.trackingEvents?.shipday?.pickup_id;
    const deliveryId = order.trackingEvents?.shipday?.delivery_id;

    let hasDriverToCollectionEvent = false;
    let hasBikeCollectedEvent = false;
    let hasDriverToDeliveryEvent = false;
    let hasDeliveredEvent = false;

    if (shipdayUpdates.length > 0) {
      const sortedUpdates = [...shipdayUpdates].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      sortedUpdates.forEach((update: ShipdayUpdate) => {
        let title = "";
        let description = update.description || "";
        let icon = <Truck className="h-4 w-4 text-courier-600" />;

        if (description.includes("way to collect")) {
          title = "Driver En Route to Collection";
          icon = <Map className="h-4 w-4 text-courier-600" />;
          hasDriverToCollectionEvent = true;
        } else if (description.includes("collected the bike")) {
          title = "Bike Collected";
          icon = <Check className="h-4 w-4 text-courier-600" />;
          hasBikeCollectedEvent = true;
        } else if (description.includes("way to deliver")) {
          title = "Driver En Route to Delivery";
          icon = <Truck className="h-4 w-4 text-courier-600" />;
          hasDriverToDeliveryEvent = true;
        } else if (description.includes("delivered the bike")) {
          title = "Delivered";
          icon = <Check className="h-4 w-4 text-green-600" />;
          hasDeliveredEvent = true;
        } else {
          const isPickup = update.orderId === pickupId;
          const statusLower = update.status?.toLowerCase();

          if (isPickup) {
            if (["on-the-way", "ready_to_deliver"].includes(statusLower)) {
              title = "Driver En Route to Collection";
              icon = <Map className="h-4 w-4 text-courier-600" />;
              description = "Driver is on the way to collect the bike";
              hasDriverToCollectionEvent = true;
            } else if (["picked-up", "delivered", "already_delivered"].includes(statusLower)) {
              title = "Bike Collected";
              icon = <Check className="h-4 w-4 text-courier-600" />;
              description = "Bike has been collected from sender";
              hasBikeCollectedEvent = true;
            }
          } else {
            if (["on-the-way", "ready_to_deliver"].includes(statusLower)) {
              title = "Driver En Route to Delivery";
              icon = <Truck className="h-4 w-4 text-courier-600" />;
              description = "Driver is on the way to deliver the bike";
              hasDriverToDeliveryEvent = true;
            } else if (["delivered", "already_delivered"].includes(statusLower)) {
              title = "Delivered";
              icon = <Check className="h-4 w-4 text-green-600" />;
              description = "Bike has been delivered to receiver";
              hasDeliveredEvent = true;
            }
          }
        }

        if (title) {
          const timestamp = new Date(update.timestamp);
          if (!eventMap[title] || timestamp > new Date(eventMap[title].date)) {
            const event = { title, date: timestamp, icon, description };
            if (!eventMap[title]) {
              events.push(event);
            } else {
              const index = events.findIndex((e) => e.title === title);
              if (index !== -1) events[index] = event;
            }
            eventMap[title] = event;
          }
        }
      });
    }

    // Only apply fallback status-based events if no Shipday updates
    if (shipdayUpdates.length === 0) {
      if (order.status === "sender_availability_pending" && !eventMap["Awaiting Collection Dates"]) {
        events.push({
          title: "Awaiting Collection Dates",
          date: order.updatedAt || order.createdAt,
          icon: <Clock className="h-4 w-4 text-courier-600" />,
          description: "Waiting for sender to confirm availability dates",
        });
      }

      if (order.status === "receiver_availability_pending" && !eventMap["Awaiting Delivery Dates"]) {
        events.push({
          title: "Awaiting Delivery Dates",
          date: order.updatedAt || order.createdAt,
          icon: <Clock className="h-4 w-4 text-courier-600" />,
          description: "Waiting for receiver to confirm availability dates",
        });
      }

      if (order.status === "scheduled_dates_pending" && !eventMap["Scheduling in Progress"]) {
        events.push({
          title: "Scheduling in Progress",
          date: order.updatedAt || order.createdAt,
          icon: <Calendar className="h-4 w-4 text-courier-600" />,
          description: "Transport team is scheduling your pickup and delivery",
        });
      }

      if (
        !hasDriverToCollectionEvent &&
        !eventMap["Driver En Route to Collection"] &&
        ["driver_to_collection", "collected", "driver_to_delivery", "shipped", "delivered"].includes(order.status)
      ) {
        events.push({
          title: "Driver En Route to Collection",
          date: order.updatedAt,
          icon: <Map className="h-4 w-4 text-courier-600" />,
          description: "Driver is on the way to collect the bike",
        });
      }

      if (
        !hasBikeCollectedEvent &&
        !eventMap["Bike Collected"] &&
        ["collected", "driver_to_delivery", "shipped", "delivered"].includes(order.status)
      ) {
        events.push({
          title: "Bike Collected",
          date: order.updatedAt,
          icon: <Check className="h-4 w-4 text-courier-600" />,
          description: "Bike has been collected from sender",
        });
      }

      if (
        !hasDriverToDeliveryEvent &&
        !eventMap["Driver En Route to Delivery"] &&
        ["driver_to_delivery", "shipped", "delivered"].includes(order.status)
      ) {
        events.push({
          title: "Driver En Route to Delivery",
          date: order.updatedAt,
          icon: <Truck className="h-4 w-4 text-courier-600" />,
          description: "Driver is on the way to deliver the bike",
        });
      }

      if (
        order.status === "shipped" &&
        !eventMap["In Transit"]
      ) {
        events.push({
          title: "In Transit",
          date: order.updatedAt,
          icon: <Truck className="h-4 w-4 text-courier-600" />,
          description: "Bike is in transit",
        });
      }

      if (
        !hasDeliveredEvent &&
        !eventMap["Delivered"] &&
        order.status === "delivered"
      ) {
        events.push({
          title: "Delivered",
          date: order.updatedAt,
          icon: <Check className="h-4 w-4 text-green-600" />,
          description: "Bike has been delivered to receiver",
        });
      }
    }

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
