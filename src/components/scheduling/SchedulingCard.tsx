
import React from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin } from "lucide-react";
import { SchedulingGroup } from "@/services/schedulingService";
import { useDraggable } from "@/hooks/useDraggable";
import { extractOutwardCode } from "@/utils/locationUtils";
import JobSchedulingForm from "./JobSchedulingForm";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

// Create a type-safe helper function to get the correct badge variant
const getPolygonBadgeVariant = (segment: number | undefined) => {
  if (!segment) return undefined;
  
  // Ensure segment is between 1-8
  const safeSegment = Math.min(Math.max(1, segment), 8);
  
  // Use type assertion to tell TypeScript this is a valid badge variant
  return `p${safeSegment}-segment` as 
    "p1-segment" | "p2-segment" | "p3-segment" | "p4-segment" | 
    "p5-segment" | "p6-segment" | "p7-segment" | "p8-segment";
};

interface SchedulingCardProps {
  group: SchedulingGroup;
  onSchedule: (group: SchedulingGroup) => void;
}

const SchedulingCard: React.FC<SchedulingCardProps> = ({ group, onSchedule }) => {
  const { dragRef, isDragging } = useDraggable({
    type: "scheduling-group",
    item: group,
  });

  // Get the first order in the group
  const firstOrder = group.orders[0];
  const isPickup = group.type === 'pickup';
  
  // Get the contact info based on whether this is a pickup or delivery
  const contact = isPickup ? firstOrder.sender : firstOrder.receiver;
  const contactType = isPickup ? "Sender" : "Receiver";
  
  // Get bike information
  const bikeInfo = `${firstOrder.bikeBrand || ""} ${firstOrder.bikeModel || ""}`.trim() || "Bike";
  
  // Extract postcode outward code for display
  const postcodeOutward = extractOutwardCode(contact.address.zipCode);

  // Check if the job is scheduled and get the scheduled date
  const scheduledDate = isPickup 
    ? firstOrder.scheduledPickupDate 
    : firstOrder.scheduledDeliveryDate;

  const isScheduled = Boolean(scheduledDate);

  // Debug logging to see what date values we have
  console.log(`${group.type} card for order ${firstOrder.id}:`, {
    scheduledDate,
    isScheduled,
    pickupDate: firstOrder.scheduledPickupDate,
    deliveryDate: firstOrder.scheduledDeliveryDate
  });

  // Get polygon badge variant using our type-safe helper
  const badgeVariant = getPolygonBadgeVariant(firstOrder.polygonSegment);

  return (
    <Card 
      ref={dragRef} 
      className={`w-full mb-4 cursor-move transition-all ${isDragging ? 'opacity-50' : 'opacity-100'} ${isPickup ? 'bg-green-50' : 'bg-blue-50'}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center">
            <span className={`mr-2 w-3 h-3 rounded-full ${group.isOptimal ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
            <span>{isPickup ? 'Collection' : 'Delivery'}</span>
          </div>
          <div className="flex items-center gap-2">
            {firstOrder.polygonSegment && badgeVariant && (
              <Badge 
                variant={badgeVariant}
                className="text-xs"
              >
                P{firstOrder.polygonSegment}
              </Badge>
            )}
            {isScheduled && (
              <Badge variant="outline" className="text-xs">Scheduled</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pb-2">
        <div className="flex flex-col space-y-2 text-sm">
          <div className="flex items-start">
            <MapPin className="w-4 h-4 mr-2 mt-1 text-muted-foreground" />
            <span>
              {contact.address.street}, {contact.address.city} 
              <div className="font-medium">{postcodeOutward}</div>
            </span>
          </div>
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
            <div className="space-y-1">
              {isScheduled && scheduledDate ? (
                <>
                  <div>Scheduled for:</div>
                  <div className="font-medium text-green-600">
                    {format(new Date(scheduledDate), 'MMM d, yyyy h:mm a')}
                  </div>
                </>
              ) : (
                <>
                  <div>Available dates:</div>
                  <div className="text-muted-foreground">
                    {isPickup 
                      ? (group.dateRange.pickup.length > 0 
                          ? group.dateRange.pickup.map(date => 
                              format(date, 'MMM d, yyyy h:mm a')).join(', ')
                          : 'No dates available')
                      : (group.dateRange.delivery.length > 0 
                          ? group.dateRange.delivery.map(date => 
                              format(date, 'MMM d, yyyy h:mm a')).join(', ')
                          : 'No dates available')
                    }
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col">
        {!isScheduled && (
          <JobSchedulingForm 
            orderId={firstOrder.id} 
            type={group.type} 
            onScheduled={() => onSchedule(group)}
            compact
          />
        )}
      </CardFooter>
    </Card>
  );
};

export default SchedulingCard;
