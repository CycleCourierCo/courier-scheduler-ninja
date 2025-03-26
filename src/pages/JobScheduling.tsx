
import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  getPendingSchedulingOrders, 
  groupOrdersByLocation, 
  SchedulingGroup,
  scheduleOrderGroup
} from "@/services/schedulingService";
import { getLocationName } from "@/utils/locationUtils";
import SchedulingDialog from "@/components/scheduling/SchedulingDialog";
import SchedulingStats from "@/components/scheduling/SchedulingStats";
import SchedulingGroupList from "@/components/scheduling/SchedulingGroupList";

const JobScheduling: React.FC = () => {
  const [selectedGroup, setSelectedGroup] = useState<SchedulingGroup | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();
  
  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: ['scheduling-orders'],
    queryFn: getPendingSchedulingOrders
  });
  
  useEffect(() => {
    console.log("Orders data:", orders);
  }, [orders]);
  
  const scheduleMutation = useMutation({
    mutationFn: ({ group, date }: { group: SchedulingGroup, date: Date }) => 
      scheduleOrderGroup(group, date),
    onSuccess: () => {
      toast.success("Orders scheduled successfully");
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['scheduling-orders'] });
    },
    onError: () => {
      toast.error("Failed to schedule orders");
    }
  });
  
  // Use a single grouping function without the type parameter
  const allGroups = orders ? groupOrdersByLocation(orders) : [];
  
  // Filter for pending groups only
  const pendingGroups = allGroups.filter(group => 
    group.orders.some(order => 
      order.status === 'scheduled_dates_pending' || 
      order.status === 'pending_approval' ||
      order.status === 'sender_availability_confirmed' ||
      order.status === 'receiver_availability_confirmed'
    )
  );
  
  // Use pending groups for the location map
  const locationGroupsMap = pendingGroups.reduce<Record<string, SchedulingGroup[]>>((acc, group) => {
    const firstOrder = group.orders[0];
    const representativeContact = firstOrder.sender;
    
    const locationKey = getLocationName(representativeContact);
    
    if (!acc[locationKey]) {
      acc[locationKey] = [];
    }
    
    acc[locationKey].push(group);
    return acc;
  }, {});
  
  const locationGroups = Object.entries(locationGroupsMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([location, groups]) => ({ location, groups }));
  
  const handleScheduleGroup = (group: SchedulingGroup) => {
    setSelectedGroup(group);
    setIsDialogOpen(true);
  };
  
  const handleConfirmSchedule = () => {
    if (selectedGroup && scheduleDate) {
      scheduleMutation.mutate({ group: selectedGroup, date: scheduleDate });
    }
  };
  
  if (error) {
    console.error("Error loading orders:", error);
  }

  return (
    <Layout>
      <div className="container py-6">
        <h1 className="text-3xl font-bold mb-6">Job Scheduling</h1>
        
        <SchedulingStats 
          orders={orders}
          pendingGroupsCount={pendingGroups.length}
          onRefresh={refetch}
          isLoading={isLoading}
        />
        
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="bg-card rounded-lg p-4 shadow mb-8">
            <h2 className="text-xl font-semibold mb-4">Pending Order Groups</h2>
            
            <SchedulingGroupList
              locationGroups={locationGroups}
              onScheduleGroup={handleScheduleGroup}
            />
          </div>
        )}
        
        <SchedulingDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          selectedGroup={selectedGroup}
          scheduleDate={scheduleDate}
          onScheduleDateChange={setScheduleDate}
          onConfirmSchedule={handleConfirmSchedule}
          isScheduling={scheduleMutation.isPending}
        />
      </div>
    </Layout>
  );
};

export default JobScheduling;
