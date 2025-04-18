import React from "react";
import { format } from "date-fns";
import { Order, ShipdayUpdate } from "@/types/order";
import {
  Package,
  ClipboardEdit,
  Calendar,
  Truck,
  Check,
  Clock,
  Map,
} from "lucide-react";

interface TrackingTimelineProps {
  order: Order;
}

const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ order }) => {
  const getEventTimestamp = (
    updates: ShipdayUpdate[],
    matcher: (u: ShipdayUpdate) => boolean
  ): Date | null => {
    const sorted = updates
      .filter(matcher)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return sorted.length > 0 ? new Date(sorted[sorted.length - 1].timestamp) : null;
  };

  const getTrackingEvents = () => {
    const events = [];
    const eventMap: Record<string, any> = {};

    // Base events
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
      events.push({
        title: "Collection Dates Chosen",
        date: order.senderConfirmedAt,
        icon: <ClipboardEdit className="h-4 w-4 text-courier-600" />,
        description: "Collection dates have been confirmed",
      });
    }

    if (order.receiverConfirmedAt) {
      events.push({
        title: "Delivery Dates Chosen",
        date: order.receiverConfirmedAt,
        icon: <ClipboardEdit className="h-4 w-4 text-courier-600" />,
        description: "Delivery dates have been confirmed",
      });
    }

    if (order.scheduledAt) {
      events.push({
        title: "Transport Scheduled",
        date: order.scheduledAt,
        icon: <Calendar className="h-4 w-4 text-courier-600" />,
        description: "Transport manager has scheduled pickup and delivery",
      });
    }

    // Shipday updates
    const shipdayUpdates = order.trackingEvents?.shipday?.updates || [];
    const pickupId = order.trackingEvents?.shipday?.pickup_id;
    const deliveryId = order.trackingEvents?.shipday?.delivery_id;

    const driverToCollectionDate = getEventTimestamp(
      shipdayUpdates,
      (u) =>
        u.description?.includes("way to collect") ||
        (u.status?.toLowerCase() === "on-the-way" && u.orderId === pickupId)
    );

    const bikeCollectedDate = getEventTimestamp(
      shipdayUpdates,
      (u) =>
        u.description?.includes("collected the bike") ||
        (u.status?.toLowerCase() === "picked_up" && u.orderId === pickupId) ||
        (["delivered", "already_delivered"].includes(u.status?.toLowerCase()) && u.orderId === pickupId)
    );

    const driverToDeliveryDate = getEventTimestamp(
      shipdayUpdates,
      (u) =>
        u.description?.includes("way to deliver") ||
        (u.status?.toLowerCase() === "on-the-way" && u.orderId === deliveryId)
    );

    const deliveredDate = getEventTimestamp(
      shipdayUpdates,
      (u) =>
        u.description?.includes("delivered the bike") ||
        (["delivered", "already_delivered"].includes(u.status?.toLowerCase()) &&
          u.orderId === deliveryId)
    );

    if (driverToCollectionDate) {
      const event = {
        title: "Driver En Route to Collection",
        date: driverToCollectionDate,
        icon: <Map className="h-4 w-4 text-courier-600" />,
        description: "Driver is on the way to collect the bike",
      };
      events.push(event);
      eventMap["Driver En Route to Collection"] = event;
    }

    if (bikeCollectedDate) {
      const event = {
        title: "Bike Collected",
        date: bikeCollectedDate,
        icon: <Check className="h-4 w-4 text-courier-600" />,
        description: "Bike has been collected from sender",
      };
      events.push(event);
      eventMap["Bike Collected"] = event;
    }

    if (driverToDeliveryDate) {
      const event = {
        title: "Driver En Route to Delivery",
        date: driverToDeliveryDate,
        icon: <Truck className="h-4 w-4 text-courier-600" />,
        description: "Driver is on the way to deliver the bike",
      };
      events.push(event);
      eventMap["Driver En Route to Delivery"] = event;
    }

    if (deliveredDate) {
      const event = {
        title: "Delivered",
        date: deliveredDate,
        icon: <Check className="h-4 w-4 text-green-600" />,
        description: "Bike has been delivered to receiver",
      };
      events.push(event);
      eventMap["Delivered"] = event;
    }

    // If no Shipday updates at all — fallback status-based entries
    if (shipdayUpdates.length === 0) {
      if (order.status === "sender_availability_pending") {
        events.push({
          title: "Awaiting Collection Dates",
          date: order.updatedAt || order.createdAt,
          icon: <Clock className="h-4 w-4 text-courier-600" />,
          description: "Waiting for sender to confirm availability dates",
        });
      }

      if (order.status === "receiver_availability_pending") {
        events.push({
          title: "Awaiting Delivery Dates",
          date: order.updatedAt || order.createdAt,
          icon: <Clock className="h-4 w-4 text-courier-600" />,
          description: "Waiting for receiver to confirm availability dates",
        });
      }

      if (order.status === "scheduled_dates_pending") {
        events.push({
          title: "Scheduling in Progress",
          date: order.updatedAt || order.createdAt,
          icon: <Calendar className="h-4 w-4 text-courier-600" />,
          description: "Transport team is scheduling your pickup and delivery",
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
