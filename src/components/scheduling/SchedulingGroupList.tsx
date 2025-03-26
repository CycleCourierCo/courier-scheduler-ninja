
import React from "react";
import { SchedulingGroup } from "@/services/schedulingService";
import SchedulingCard from "@/components/scheduling/SchedulingCard";
import { Badge } from "@/components/ui/badge";

interface LocationGroup {
  location: string;
  groups: SchedulingGroup[];
}

interface SchedulingGroupListProps {
  locationGroups: LocationGroup[];
  onScheduleGroup: (group: SchedulingGroup) => void;
}

const SchedulingGroupList: React.FC<SchedulingGroupListProps> = ({ 
  locationGroups,
  onScheduleGroup
}) => {
  if (locationGroups.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No pending order groups to schedule
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {locationGroups.map(({ location, groups }) => (
        <div key={location} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-lg font-medium">{location}</h3>
            <Badge variant="outline">{groups.length} groups</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {groups.map((group) => (
              <SchedulingCard 
                key={group.id} 
                group={group}
                onSchedule={onScheduleGroup}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SchedulingGroupList;
