
import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  getPendingSchedulingOrders, 
  groupOrdersByLocation, 
  SchedulingGroup,
  scheduleOrderGroup
} from "@/services/schedulingService";
import SchedulingCard from "@/components/scheduling/SchedulingCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { getLocationName } from "@/utils/locationUtils";

const JobScheduling: React.FC = () => {
  const [selectedGroup, setSelectedGroup] = useState<SchedulingGroup | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();
  
  // Fetch pending orders and scheduled orders
  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: ['scheduling-orders'],
    queryFn: getPendingSchedulingOrders
  });
  
  useEffect(() => {
    console.log("Orders data:", orders);
  }, [orders]);
  
  // Mutation for scheduling orders
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
  
  // Process orders into all groups, both pickups and deliveries
  const allGroups = orders ? [
    ...groupOrdersByLocation(orders, 'pickup'),
    ...groupOrdersByLocation(orders, 'delivery')
  ] : [];
  
  // Get pending groups (not scheduled)
  const pendingGroups = allGroups.filter(group => 
    group.orders.some(order => 
      order.status === 'scheduled_dates_pending' || 
      order.status === 'pending_approval' ||
      order.status === 'sender_availability_confirmed' ||
      order.status === 'receiver_availability_confirmed'
    )
  );
  
  // Group the pending groups by location (proximity areas)
  const locationGroupsMap = pendingGroups.reduce<Record<string, SchedulingGroup[]>>((acc, group) => {
    // Get a representative contact for the group based on type
    const firstOrder = group.orders[0];
    const representativeContact = group.type === 'pickup' 
      ? firstOrder.sender 
      : firstOrder.receiver;
    
    // Get a location name to use as a key
    const locationKey = getLocationName(representativeContact);
    
    if (!acc[locationKey]) {
      acc[locationKey] = [];
    }
    
    acc[locationKey].push(group);
    return acc;
  }, {});
  
  // Convert the map to a sorted array of entries
  const locationGroups = Object.entries(locationGroupsMap).sort((a, b) => a[0].localeCompare(b[0]));
  
  // Handle scheduling a group from the card
  const handleScheduleGroup = (group: SchedulingGroup) => {
    setSelectedGroup(group);
    setIsDialogOpen(true);
  };
  
  // Handle confirming scheduling with a selected date
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
        
        <div className="mb-4 flex justify-between items-center">
          <div>
            {orders ? (
              <div>
                <p className="text-muted-foreground">
                  Found {orders.length} orders ({pendingGroups.length} groups pending scheduling)
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
          <Button onClick={() => refetch()} variant="outline">
            Refresh
          </Button>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="bg-card rounded-lg p-4 shadow mb-8">
            <h2 className="text-xl font-semibold mb-4">Pending Order Groups</h2>
            
            {pendingGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pending order groups to schedule
              </div>
            ) : (
              <div className="space-y-8">
                {locationGroups.map(([location, groups]) => (
                  <div key={location} className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-lg font-medium">{location}</h3>
                      <Badge variant="outline">{groups.length} groups</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {groups.map((group) => (
                        <SchedulingCard 
                          key={`${group.type}-${group.id}`} 
                          group={group}
                          onSchedule={handleScheduleGroup}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Scheduling dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Group</DialogTitle>
            </DialogHeader>
            
            {selectedGroup && (
              <div className="py-4">
                <div className="mb-4">
                  <h3 className="font-medium mb-2">Group Details</h3>
                  <p>From: {selectedGroup.locationPair.from}</p>
                  <p>To: {selectedGroup.locationPair.to}</p>
                  <p>Orders: {selectedGroup.orders.length}</p>
                  <p>Type: {selectedGroup.type === 'pickup' ? 'Collection' : 'Delivery'}</p>
                </div>
                
                <div className="mb-4">
                  <h3 className="font-medium mb-2">Select Schedule Date</h3>
                  <Calendar
                    mode="single"
                    selected={scheduleDate}
                    onSelect={setScheduleDate}
                    className="rounded-md border"
                  />
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmSchedule}
                disabled={!scheduleDate || scheduleMutation.isPending}
              >
                {scheduleMutation.isPending ? "Scheduling..." : "Confirm Schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default JobScheduling;
