
import React from "react";
import { format, isValid, parseISO } from "date-fns";
import { Order, ShipdayUpdate } from "@/types/order";
import { Package, ClipboardEdit, Calendar, Truck, Check, Clock, MapPin, Map, Bike, AlertCircle } from "lucide-react";

interface TrackingTimelineProps {
  order: Order;
}

// Helper function to safely format dates
const formatDate = (dateInput: Date | string | undefined): string => {
  try {
    if (!dateInput) return "Date unknown";
    
    // If it's a string, parse it first
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    
    // Make sure the date is valid before formatting
    if (!isValid(date)) {
      console.warn("Invalid date encountered:", dateInput);
      return "Invalid date";
    }
    
    return format(date, "PPP 'at' p");
  } catch (error) {
    console.error("Error formatting date:", error, dateInput);
    return "Date format error";
  }
};

const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ order }) => {
  console.log("TrackingTimeline rendering with order:", order.id);
  console.log("TrackingTimeline tracking events:", JSON.stringify(order.trackingEvents, null, 2));

  const getTrackingEvents = () => {
    console.log("Getting tracking events for order:", order.id);
    const events = [];
    
    // Add the creation event first (this always exists)
    events.push({
      title: "Order Created",
      date: order.createdAt,
      icon: <Package className="h-4 w-4 text-courier-600" />,
      description: order.trackingNumber ? 
        `Order created with tracking number: ${order.trackingNumber}` : 
        "Order created successfully"
    });
    
    // Add confirmation events with their original timestamps
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
    
    // Process Shipday tracking events if available
    if (order.trackingEvents?.shipday?.updates && order.trackingEvents.shipday.updates.length > 0) {
      console.log("Processing Shipday updates:", order.trackingEvents.shipday.updates);
      
      const shipdayUpdates = order.trackingEvents.shipday.updates;
      const pickupId = order.trackingEvents.shipday.pickup_id?.toString();
      const deliveryId = order.trackingEvents.shipday.delivery_id?.toString();
      
      console.log("Pickup ID:", pickupId, "Delivery ID:", deliveryId);
      
      // Process each Shipday update (removed duplicate prevention to allow multiple of same event type)
      
      // Process each Shipday update
      shipdayUpdates.forEach((update: ShipdayUpdate) => {
        try {
          console.log("Processing update:", update);
          
          // Process ORDER_ONTHEWAY, ORDER_POD_UPLOAD, ORDER_COMPLETED, and ORDER_FAILED events
          if (update.event !== "ORDER_ONTHEWAY" && update.event !== "ORDER_POD_UPLOAD" && 
              update.event !== "ORDER_COMPLETED" && update.event !== "ORDER_FAILED") {
            console.log("Skipping non-tracking event:", update.event);
            return;
          }
          
          // Check if the update is for pickup or delivery based on orderId or description
          const isPickup = update.orderId === pickupId || 
                          (update.orderId !== deliveryId && update.description?.toLowerCase().includes("collect"));
          const isDelivery = update.orderId === deliveryId || 
                            (update.orderId !== pickupId && update.description?.toLowerCase().includes("deliver"));
          
          console.log(`Update orderId: ${update.orderId}, isPickup: ${isPickup}, isDelivery: ${isDelivery}`);
          
          let title = "";
          let icon = <Truck className="h-4 w-4 text-courier-600" />;
          let description = update.description || "";
          
          // Determine the event title and icon based on the event type
          if (update.event === "ORDER_ONTHEWAY") {
            if (isPickup) {
              title = "Driver En Route to Collection";
              icon = <Map className="h-4 w-4 text-courier-600" />;
              if (!description) description = "Driver is on the way to collect the bike";
            } else if (isDelivery) {
              title = "Driver En Route to Delivery";
              icon = <Truck className="h-4 w-4 text-courier-600" />;
              if (!description) description = "Driver is on the way to deliver the bike";
            }
          } else if (update.event === "ORDER_POD_UPLOAD" || update.event === "ORDER_COMPLETED") {
            if (isPickup) {
              title = "Bike Collected";
              icon = <Check className="h-4 w-4 text-courier-600" />;
              if (!description) description = "Bike has been collected from sender";
            } else if (isDelivery) {
              title = "Delivered";
              icon = <Check className="h-4 w-4 text-green-600" />;
              if (!description) description = "Bike has been delivered to receiver";
            }
          } else if (update.event === "ORDER_FAILED") {
            if (isPickup) {
              title = "Collection Failed";
              icon = <AlertCircle className="h-4 w-4 text-red-600" />;
              if (!description) description = "Collection attempt failed - rescheduling required";
            } else if (isDelivery) {
              title = "Delivery Failed";
              icon = <AlertCircle className="h-4 w-4 text-red-600" />;
              if (!description) description = "Delivery attempt failed - rescheduling required";
            }
          }
          
          console.log("Determined event title:", title);
          
          // Add the event if we have a title and timestamp
          if (title && update.timestamp) {
            console.log(`Adding event: ${title} with timestamp: ${update.timestamp}`);
            events.push({
              title,
              date: update.timestamp,
              icon,
              description
            });
          }
        } catch (error) {
          console.error("Error processing Shipday update:", error, update);
        }
      });
    } else {
      console.log("No Shipday updates found or updates array is empty");
      console.log("order.trackingEvents:", order.trackingEvents);
      console.log("order.trackingEvents?.shipday:", order.trackingEvents?.shipday);
      
      // Try to infer tracking events from order status
      if (order.status === "driver_to_collection" || order.status === "driver_to_delivery" ||
          order.status === "collected" || order.status === "delivered") {
        
        console.log("Inferring tracking events from order status:", order.status);
        
        if (order.status === "driver_to_collection" && !events.some(e => e.title === "Driver En Route to Collection")) {
          events.push({
            title: "Driver En Route to Collection",
            date: order.updatedAt,
            icon: <Map className="h-4 w-4 text-courier-600" />,
            description: "Driver is on the way to collect the bike"
          });
        }
        
        if ((order.status === "collected" || order.status === "driver_to_delivery" || 
             order.status === "delivered") && !events.some(e => e.title === "Bike Collected")) {
          events.push({
            title: "Bike Collected",
            date: order.updatedAt,
            icon: <Check className="h-4 w-4 text-courier-600" />,
            description: "Bike has been collected from sender"
          });
        }
        
        if (order.status === "driver_to_delivery" && !events.some(e => e.title === "Driver En Route to Delivery")) {
          events.push({
            title: "Driver En Route to Delivery",
            date: order.updatedAt,
            icon: <Truck className="h-4 w-4 text-courier-600" />,
            description: "Driver is on the way to deliver the bike"
          });
        }
        
        if (order.status === "delivered" && !events.some(e => e.title === "Delivered")) {
          events.push({
            title: "Delivered",
            date: order.updatedAt,
            icon: <Check className="h-4 w-4 text-green-600" />,
            description: "Bike has been delivered to receiver"
          });
        }
      }
    }
    
    // Add fallback events based on order status if needed
    if (events.length <= 2) { // If we only have creation and maybe scheduling events
      if (order.status === "sender_availability_pending") {
        events.push({
          title: "Awaiting Collection Dates",
          date: order.updatedAt || order.createdAt,
          icon: <Clock className="h-4 w-4 text-courier-600" />,
          description: "Waiting for sender to confirm availability dates"
        });
      }
      
      if (order.status === "receiver_availability_pending") {
        events.push({
          title: "Awaiting Delivery Dates",
          date: order.updatedAt || order.createdAt,
          icon: <Clock className="h-4 w-4 text-courier-600" />,
          description: "Waiting for receiver to confirm availability dates"
        });
      }
      
      if (order.status === "scheduled_dates_pending") {
        events.push({
          title: "Scheduling in Progress",
          date: order.updatedAt || order.createdAt,
          icon: <Calendar className="h-4 w-4 text-courier-600" />,
          description: "Transport team is scheduling your pickup and delivery"
        });
      }
    }
    
    // Sort events by date, with additional validation
    return events
      .filter(event => {
        // Filter out events with invalid dates
        if (!event.date) {
          console.warn("Event with no date found:", event.title);
          return false;
        }
        
        try {
          // Try to create a valid date object to check validity
          const date = new Date(event.date);
          if (isNaN(date.getTime())) {
            console.warn("Invalid date in event:", event.title, event.date);
            return false;
          }
          return true;
        } catch (error) {
          console.error("Error validating date in event:", event.title, event.date, error);
          return false;
        }
      })
      .sort((a, b) => {
        try {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          
          if (isNaN(dateA) || isNaN(dateB)) {
            console.warn("Invalid date encountered in final sorting:", { a: a.date, b: b.date });
            return 0;
          }
          
          return dateA - dateB;
        } catch (error) {
          console.error("Error in final sorting:", error);
          return 0;
        }
      });
  };

  const trackingEvents = getTrackingEvents();

  // For debugging
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
                  {formatDate(event.date)}
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
