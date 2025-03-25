
import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  getPendingSchedulingOrders, 
  groupOrdersByLocation, 
  organizeGroupsByDates,
  SchedulingGroup,
  scheduleOrderGroup,
  SchedulingJobGroup
} from "@/services/schedulingService";
import SchedulingCard from "@/components/scheduling/SchedulingCard";
import SchedulingCalendar from "@/components/scheduling/SchedulingCalendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";

const JobScheduling: React.FC = () => {
  const [selectedGroup, setSelectedGroup] = useState<SchedulingGroup | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draggedGroups, setDraggedGroups] = useState<SchedulingJobGroup[]>([]);
  
  const queryClient = useQueryClient();
  
  // Fetch pending orders
  const { data: orders, isLoading } = useQuery({
    queryKey: ['pending-scheduling-orders'],
    queryFn: getPendingSchedulingOrders
  });
  
  // Mutation for scheduling orders
  const scheduleMutation = useMutation({
    mutationFn: ({ group, date }: { group: SchedulingGroup, date: Date }) => 
      scheduleOrderGroup(group, date),
    onSuccess: () => {
      toast.success("Orders scheduled successfully");
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['pending-scheduling-orders'] });
    },
    onError: () => {
      toast.error("Failed to schedule orders");
    }
  });
  
  // Process orders into groups
  const groups = orders ? groupOrdersByLocation(orders) : [];
  
  // Organize groups by dates
  const jobGroups = organizeGroupsByDates(groups);
  
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
  
  // Handle dropping a group on a date
  const handleDropGroup = (group: SchedulingGroup, date: Date) => {
    // Add the group to our dropped groups state
    const dateStr = date.toISOString().split('T')[0];
    
    // Check if we already have this date in our dragged groups
    const existingJobGroupIndex = draggedGroups.findIndex(
      jg => jg.date.toISOString().split('T')[0] === dateStr
    );
    
    if (existingJobGroupIndex >= 0) {
      // Update existing job group
      const updatedDraggedGroups = [...draggedGroups];
      const jobGroup = {...updatedDraggedGroups[existingJobGroupIndex]};
      
      // Add the group if it's not already in this date
      if (!jobGroup.groups.some(g => g.id === group.id)) {
        jobGroup.groups.push(group);
        updatedDraggedGroups[existingJobGroupIndex] = jobGroup;
        setDraggedGroups(updatedDraggedGroups);
      }
    } else {
      // Create a new job group for this date
      setDraggedGroups([
        ...draggedGroups,
        {
          date,
          groups: [group]
        }
      ]);
    }
    
    toast.info(`Group "${group.locationPair.from} → ${group.locationPair.to}" added to ${date.toLocaleDateString()}`);
  };

  return (
    <Layout>
      <div className="container py-6">
        <h1 className="text-3xl font-bold mb-6">Job Scheduling</h1>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="bg-card rounded-lg p-4 shadow">
                <h2 className="text-xl font-semibold mb-4">Available Order Groups</h2>
                
                {groups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending orders to schedule
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {groups.map((group) => (
                      <SchedulingCard 
                        key={group.id} 
                        group={group}
                        onSchedule={handleScheduleGroup}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="col-span-1">
              <div className="bg-card rounded-lg p-4 shadow">
                <h2 className="text-xl font-semibold mb-4">Scheduling Calendar</h2>
                <SchedulingCalendar 
                  jobGroups={[...jobGroups, ...draggedGroups]} 
                  onDropGroup={handleDropGroup}
                />
              </div>
            </div>
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
