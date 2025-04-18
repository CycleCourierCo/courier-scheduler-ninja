
import React from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Package } from "lucide-react";
import { SchedulingGroup } from "@/services/schedulingService";
import { useDraggable } from "@/hooks/useDraggable";
import { extractOutwardCode } from "@/utils/locationUtils";
import JobSchedulingForm from "./JobSchedulingForm";
import { Badge } from "@/components/ui/badge";

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

  // Check if the job is scheduled
  const isScheduled = isPickup 
    ? firstOrder.scheduled_pickup_date 
    : firstOrder.scheduled_delivery_date;

  return (
    <Card 
      ref={dragRef} 
      className={`w-full mb-4 cursor-move transition-all ${isDragging ? 'opacity-50' : 'opacity-100'}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center">
            <span className={`mr-2 w-3 h-3 rounded-full ${group.isOptimal ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
            <span>
              {firstOrder.id.substring(0, 8)}
            </span>
          </div>
          <div className="text-sm font-normal text-muted-foreground">
            {group.orders.length} orders
          </div>
        </CardTitle>
        {isScheduled && (
          <Badge variant="outline" className="w-fit">
            {isPickup ? 'Collection' : 'Delivery'} scheduled
          </Badge>
        )}
      </CardHeader>
      
      <CardContent className="pb-2">
        <div className="flex flex-col space-y-2 text-sm">
          <div className="flex items-center">
            <Package className="w-4 h-4 mr-2 text-muted-foreground" />
            <span className="font-semibold">{bikeInfo}</span>
          </div>
          <div>
            <span className="font-semibold">{contactType}: </span>
            <span>{contact.name}</span>
          </div>
          <div className="flex items-start">
            <MapPin className="w-4 h-4 mr-2 mt-1 text-muted-foreground" />
            <span>
              {contact.address.street}, {contact.address.city} 
              <div className="font-medium">{postcodeOutward}</div>
            </span>
          </div>
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
            <span>
              {isPickup ? 'Pickup' : 'Delivery'} dates: 
              <span className="font-semibold"> {isPickup ? group.dateRange.pickup.length : group.dateRange.delivery.length}</span>
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col">
        {!isScheduled && (
          <JobSchedulingForm 
            orderId={firstOrder.id} 
            type={group.type} 
            onScheduled={() => onSchedule(group)}
          />
        )}
      </CardFooter>
    </Card>
  );
};

export default SchedulingCard;
