
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Order } from "@/types/order";

interface SchedulingStatsProps {
  orders: Order[] | undefined;
  pendingGroupsCount: number;
  onRefresh: () => void;
  isLoading: boolean;
}

const SchedulingStats: React.FC<SchedulingStatsProps> = ({ 
  orders,
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
        {orders ? (
          <div>
            <p className="text-muted-foreground">
              Found {orders.length} orders ({pendingGroupsCount} groups pending scheduling)
            </p>
            <Badge variant="outline" className="mt-1">
              {orders.filter(o => 
                o.status === 'scheduled_dates_pending' || 
                o.status === 'pending_approval' ||
                o.status === 'sender_availability_confirmed' ||
                o.status === 'receiver_availability_confirmed'
              ).length} pending
            </Badge>
            <Badge variant="outline" className="mt-1 ml-2">
              {orders.filter(o => o.status === 'scheduled').length} scheduled
            </Badge>
          </div>
        ) : (
          <p className="text-muted-foreground">No orders found</p>
        )}
      </div>
      <Button onClick={onRefresh} variant="outline">
        Refresh
      </Button>
    </div>
  );
};

export default SchedulingStats;
