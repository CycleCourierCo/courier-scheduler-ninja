
import React, { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { Order, ShipdayUpdate } from "@/types/order";
import { Package, ClipboardEdit, Calendar, Truck, Check, Clock, MapPin, Map, Bike, AlertCircle, Image, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import PostcodeVerification from "./PostcodeVerification";

interface TrackingTimelineProps {
  order: Order;
}

// Helper function to safely format dates
const formatDate = (dateInput: Date | string | any): string => {
  try {
    if (!dateInput) return "Date unknown";
    
    let date: Date;
    
    // Handle serialized date objects from console logs (React Query/serialization)
    if (dateInput && typeof dateInput === 'object' && dateInput._type === "Date" && dateInput.value?.iso) {
      console.log("Found serialized date object, using ISO string:", dateInput.value.iso);
      date = parseISO(dateInput.value.iso);
    }
    // Handle regular objects that might have an iso property
    else if (dateInput && typeof dateInput === 'object' && dateInput.iso) {
      console.log("Found object with iso property:", dateInput.iso);
      date = parseISO(dateInput.iso);
    }
    // Handle regular objects that might have a value property with timestamp
    else if (dateInput && typeof dateInput === 'object' && dateInput.value && typeof dateInput.value === 'number') {
      console.log("Found object with timestamp value:", dateInput.value);
      date = new Date(dateInput.value);
    }
    // If it's a string, parse it first
    else if (typeof dateInput === 'string') {
      date = parseISO(dateInput);
    }
    // If it's already a Date object
    else if (dateInput instanceof Date) {
      date = dateInput;
    }
    // Try to convert to Date as fallback
    else {
      console.log("Attempting fallback date conversion for:", dateInput);
      date = new Date(dateInput);
    }
    
    // Make sure the date is valid before formatting
    if (!isValid(date)) {
      console.warn("Invalid date encountered after processing:", dateInput, "processed to:", date);
      return "Invalid date";
    }
    
    return format(date, "PPP 'at' p");
  } catch (error) {
    console.error("Error formatting date:", error, dateInput);
    return "Date format error";
  }
};

const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ order }) => {
  const [verificationDialog, setVerificationDialog] = useState<{
    isOpen: boolean;
    type: "collection" | "delivery";
    eventIndex: number;
  }>({ isOpen: false, type: "collection", eventIndex: -1 });
  const [verifiedPostcodes, setVerifiedPostcodes] = useState<Set<string>>(new Set());

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
    if (order.trackingEvents?.shipday) {
      console.log("Shipday tracking data found:", order.trackingEvents.shipday);
      
      if (order.trackingEvents.shipday.updates && order.trackingEvents.shipday.updates.length > 0) {
        console.log("Processing Shipday updates:", order.trackingEvents.shipday.updates);
        
        const shipdayUpdates = order.trackingEvents.shipday.updates;
        const pickupId = order.trackingEvents.shipday.pickup_id?.toString();
        const deliveryId = order.trackingEvents.shipday.delivery_id?.toString();
        
        console.log("Pickup ID:", pickupId, "Delivery ID:", deliveryId);
      
      // Process each Shipday update - group POD uploads with completed events
      const processedUpdates: { [key: string]: any } = {};
      
      // First pass: collect all updates and group POD uploads with their corresponding COMPLETED events
      shipdayUpdates.forEach((update: ShipdayUpdate) => {
        const key = `${update.orderId}-${update.event}`;
        
        if (update.event === "ORDER_POD_UPLOAD") {
          // Check if this POD upload describes a completion event (backwards compatibility)
          const isCompletionEvent = update.description?.toLowerCase().includes("collected") || 
                                   update.description?.toLowerCase().includes("delivered");
          
          if (isCompletionEvent) {
            // Look for existing COMPLETED event for this orderId
            const completedKey = `${update.orderId}-ORDER_COMPLETED`;
            
            if (processedUpdates[completedKey]) {
              // Merge POD data into the existing COMPLETED event
              const existingEvent = processedUpdates[completedKey];
              existingEvent.podUrls = update.podUrls || [];
              existingEvent.signatureUrl = update.signatureUrl || null;
              console.log(`Merged POD data into existing COMPLETED event for order ${update.orderId}`);
            } else {
              // No COMPLETED event exists, treat this POD_UPLOAD as the completion event (backwards compatibility)
              const completionKey = `${update.orderId}-COMPLETION`;
              if (!processedUpdates[completionKey]) {
                processedUpdates[completionKey] = {
                  ...update,
                  event: "ORDER_COMPLETED", // Convert POD_UPLOAD to COMPLETED for processing
                  podUrls: update.podUrls || [],
                  signatureUrl: update.signatureUrl || null
                };
                console.log(`Created completion event from POD_UPLOAD for order ${update.orderId} (backwards compatibility)`);
              } else {
                // Update existing completion event with POD data
                const existingEvent = processedUpdates[completionKey];
                existingEvent.podUrls = (existingEvent.podUrls || []).concat(update.podUrls || []);
                if (update.signatureUrl) existingEvent.signatureUrl = update.signatureUrl;
              }
            }
          } else {
            // This is a regular POD upload, store for later merging
            processedUpdates[`${update.orderId}-POD_PENDING`] = {
              podUrls: update.podUrls || [],
              signatureUrl: update.signatureUrl || null
            };
            console.log(`Stored POD data for later merge for order ${update.orderId}`);
          }
          return; // Don't create a separate event for POD upload
        }
        
        // For non-POD events, create the event and check for pending POD data
        if (!processedUpdates[key]) {
          processedUpdates[key] = {
            ...update,
            podUrls: update.podUrls || [],
            signatureUrl: update.signatureUrl || null
          };
          
          // If this is a COMPLETED event, check for pending POD data
          if (update.event === "ORDER_COMPLETED") {
            const podPendingKey = `${update.orderId}-POD_PENDING`;
            if (processedUpdates[podPendingKey]) {
              const podData = processedUpdates[podPendingKey];
              const eventData = processedUpdates[key];
              eventData.podUrls = podData.podUrls;
              eventData.signatureUrl = podData.signatureUrl;
              delete processedUpdates[podPendingKey]; // Clean up
              console.log(`Merged pending POD data into COMPLETED event for order ${update.orderId}`);
            }
          }
        }
      });
      
      // Second pass: process the grouped updates to create timeline events
      Object.values(processedUpdates).forEach((update: ShipdayUpdate) => {
        try {
          console.log("Processing update:", update);
          
          // Process ORDER_ONTHEWAY, ORDER_COMPLETED, and ORDER_FAILED events
          if (update.event !== "ORDER_ONTHEWAY" && 
              update.event !== "ORDER_COMPLETED" && update.event !== "ORDER_FAILED") {
            console.log("Skipping non-tracking event:", update.event);
            return;
          }
          
          // Check if the update is for pickup or delivery based on orderId only
          // Only show "driver on the way to collection" when event is ORDER_ONTHEWAY and orderId matches pickup_id
          const isPickup = update.orderId === pickupId;
          const isDelivery = update.orderId === deliveryId;
          
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
          } else if (update.event === "ORDER_COMPLETED") {
            if (isPickup) {
              title = "Bike Collected";
              icon = <Check className="h-4 w-4 text-courier-600" />;
              if (!description) description = "Driver has collected the bike";
            } else if (isDelivery) {
              title = "Delivered";
              icon = <Check className="h-4 w-4 text-green-600" />;
              if (!description) description = "Driver has delivered the bike";
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
              description,
              podUrls: update.podUrls,
              signatureUrl: update.signatureUrl,
              isPickup,
              isDelivery
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
      }
    }
    
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

  const handlePostcodeVerification = (postcode: string) => {
    const { type, eventIndex } = verificationDialog;
    const key = `${type}-${eventIndex}`;
    setVerifiedPostcodes(prev => new Set([...prev, key]));
  };

  const openVerificationDialog = (type: "collection" | "delivery", eventIndex: number) => {
    setVerificationDialog({ isOpen: true, type, eventIndex });
  };

  const closeVerificationDialog = () => {
    setVerificationDialog({ isOpen: false, type: "collection", eventIndex: -1 });
  };

  const isPostcodeVerified = (type: "collection" | "delivery", eventIndex: number) => {
    const key = `${type}-${eventIndex}`;
    return verifiedPostcodes.has(key);
  };

  const getExpectedPostcode = (type: "collection" | "delivery") => {
    if (type === "collection") {
      return order.sender?.address?.zipCode || "";
    } else {
      return order.receiver?.address?.zipCode || "";
    }
  };

  return (
    <div>
      <div className="flex items-center space-x-2">
        <Truck className="text-courier-600" />
        <h3 className="font-semibold">Tracking Details</h3>
      </div>
      
      {trackingEvents.length > 0 ? (
        <div className="space-y-3 mt-4 overflow-hidden">
          {trackingEvents.map((event, index) => (
            <div key={index} className="relative pl-6 pb-3 min-w-0">
              {index < trackingEvents.length - 1 && (
                <div className="absolute top-2 left-[7px] h-full w-0.5 bg-gray-200" />
              )}
              <div className="absolute top-1 left-0 rounded-full bg-white">
                {event.icon}
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="font-medium text-gray-800 break-words">{event.title}</p>
                <p className="text-xs sm:text-sm text-gray-500 break-words">
                  {formatDate(event.date)}
                </p>
                <p className="text-xs sm:text-sm break-words">{event.description}</p>
                
                {/* Display POD images if available with postcode protection */}
                {(event as any).podUrls && (event as any).podUrls.length > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center gap-1 mb-2">
                      <Image className="h-4 w-4 text-courier-600" />
                      <span className="text-sm font-medium text-gray-700">Proof of Delivery:</span>
                    </div>
                    {(() => {
                      const eventType = (event as any).isPickup ? "collection" : "delivery";
                      const isVerified = isPostcodeVerified(eventType, index);
                      
                      if (!isVerified) {
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openVerificationDialog(eventType, index)}
                            className="flex items-center gap-2"
                          >
                            <Lock className="h-4 w-4" />
                            Verify {eventType} postcode to view images
                          </Button>
                        );
                      }
                      
                      return (
                        <div className="flex gap-2 flex-wrap">
                          {(event as any).podUrls.map((url: string, imgIndex: number) => (
                            <a 
                              key={imgIndex}
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="block border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                            >
                              <img 
                                src={url} 
                                alt={`POD ${imgIndex + 1}`}
                                className="w-20 h-20 object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            </a>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
                
                {/* Display signature if available with postcode protection */}
                {(event as any).signatureUrl && (
                  <div className="mt-2">
                    <div className="flex items-center gap-1 mb-2">
                      <Image className="h-4 w-4 text-courier-600" />
                      <span className="text-sm font-medium text-gray-700">Signature:</span>
                    </div>
                    {(() => {
                      const eventType = (event as any).isPickup ? "collection" : "delivery";
                      const isVerified = isPostcodeVerified(eventType, index);
                      
                      if (!isVerified) {
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openVerificationDialog(eventType, index)}
                            className="flex items-center gap-2"
                          >
                            <Lock className="h-4 w-4" />
                            Verify {eventType} postcode to view signature
                          </Button>
                        );
                      }
                      
                      return (
                        <a 
                          href={(event as any).signatureUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block border rounded-lg overflow-hidden hover:shadow-md transition-shadow w-fit"
                        >
                          <img 
                            src={(event as any).signatureUrl} 
                            alt="Signature"
                            className="w-20 h-20 object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </a>
                      );
                    })()}
                  </div>
                )}
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
      
      {/* Postcode Verification Dialog */}
      <PostcodeVerification
        isOpen={verificationDialog.isOpen}
        onClose={closeVerificationDialog}
        onVerify={handlePostcodeVerification}
        type={verificationDialog.type}
        expectedPostcode={getExpectedPostcode(verificationDialog.type)}
      />
    </div>
  );
};

export default TrackingTimeline;
