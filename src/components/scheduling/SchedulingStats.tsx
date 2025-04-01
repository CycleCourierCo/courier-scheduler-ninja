
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SchedulingStatsProps {
  pendingOrdersCount: number;
  pendingGroupsCount: number;
  onRefresh: () => void;
  isLoading: boolean;
}

const SchedulingStats: React.FC<SchedulingStatsProps> = ({ 
  pendingOrdersCount,
  pendingGroupsCount,
  onRefresh,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div className="mb-4 flex justify-between items-center">
        <div>
          <p className="text-muted-foreground">Loading orders...</p>
        </div>
        <Button onClick={onRefresh} variant="outline" disabled>
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-4 flex justify-between items-center">
      <div>
        {pendingOrdersCount > 0 ? (
          <div>
            <p className="text-muted-foreground">
              Found {pendingOrdersCount} orders pending scheduling ({pendingGroupsCount} groups)
            </p>
            <Badge variant="outline" className="mt-1">
              {pendingGroupsCount} groups to schedule
            </Badge>
          </div>
        ) : (
          <p className="text-muted-foreground">No pending orders found</p>
        )}
      </div>
      <Button onClick={onRefresh} variant="outline">
        Refresh
      </Button>
    </div>
  );
};

export default SchedulingStats;
