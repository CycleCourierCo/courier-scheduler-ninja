
import React from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Truck, Package } from "lucide-react";
import { SchedulingGroup } from "@/services/schedulingService";
import { useDraggable } from "@/hooks/useDraggable";

interface SchedulingCardProps {
  group: SchedulingGroup;
  onSchedule: (group: SchedulingGroup) => void;
  isPickup: boolean;
}

const SchedulingCard: React.FC<SchedulingCardProps> = ({ group, onSchedule, isPickup }) => {
  const { dragRef, isDragging } = useDraggable({
    type: "scheduling-group",
    item: group,
  });

  const TypeIcon = isPickup ? Package : Truck;

  return (
    <Card 
      ref={dragRef} 
      className={`w-full mb-4 cursor-move transition-all ${isDragging ? 'opacity-50' : 'opacity-100'}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center">
            <span className={`mr-2 w-3 h-3 rounded-full ${group.isOptimal ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
            <TypeIcon className="w-4 h-4 mr-2 text-muted-foreground" />
            <span>
              {group.locationPair.from} → {group.locationPair.to}
            </span>
          </div>
          <div className="text-sm font-normal text-muted-foreground">
            {group.orders.length} orders
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex flex-col space-y-2 text-sm">
          <div className="flex items-center">
            <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
            <span>From: <span className="font-semibold">{group.locationPair.from}</span></span>
          </div>
          <div className="flex items-center">
            <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
            <span>To: <span className="font-semibold">{group.locationPair.to}</span></span>
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
      <CardFooter>
        <Button 
          onClick={() => onSchedule(group)} 
          variant="outline" 
          className="w-full"
        >
          Schedule {isPickup ? 'Collection' : 'Delivery'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SchedulingCard;
