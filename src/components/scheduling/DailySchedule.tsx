
import React from "react";
import { SchedulingGroup } from "@/services/schedulingService";
import SchedulingCard from "@/components/scheduling/SchedulingCard";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export interface DayScheduleData {
  date: Date;
  pickupGroups: SchedulingGroup[];
  deliveryGroups: SchedulingGroup[];
}

interface DailyScheduleProps {
  dayData: DayScheduleData;
  onScheduleGroup: (group: SchedulingGroup) => void;
}

const DailySchedule: React.FC<DailyScheduleProps> = ({ 
  dayData,
  onScheduleGroup
}) => {
  const totalGroups = dayData.pickupGroups.length + dayData.deliveryGroups.length;
  
  if (totalGroups === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No orders scheduled for this day
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pickup section */}
      {dayData.pickupGroups.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-lg font-medium">Collections</h3>
            <Badge variant="outline">{dayData.pickupGroups.length} groups</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {dayData.pickupGroups.map((group) => (
              <SchedulingCard 
                key={`${group.type}-${group.id}`} 
                group={group}
                onSchedule={onScheduleGroup}
              />
            ))}
          </div>
        </div>
      )}
      
      {dayData.pickupGroups.length > 0 && dayData.deliveryGroups.length > 0 && (
        <Separator className="my-4" />
      )}
      
      {/* Delivery section */}
      {dayData.deliveryGroups.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-lg font-medium">Deliveries</h3>
            <Badge variant="outline">{dayData.deliveryGroups.length} groups</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {dayData.deliveryGroups.map((group) => (
              <SchedulingCard 
                key={`${group.type}-${group.id}`} 
                group={group}
                onSchedule={onScheduleGroup}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailySchedule;
