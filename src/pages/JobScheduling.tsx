
import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  getPendingSchedulingOrders, 
  groupOrdersByDate,
  SchedulingGroup,
  scheduleOrderGroup,
  optimizeRoutes
} from "@/services/schedulingService";
import { getLocationName } from "@/utils/locationUtils";
import SchedulingDialog from "@/components/scheduling/SchedulingDialog";
import SchedulingStats from "@/components/scheduling/SchedulingStats";
import SchedulingCalendar from "@/components/scheduling/SchedulingCalendar";
import RouteMap from "@/components/scheduling/RouteMap";
import { format, addDays } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DailySchedule from "@/components/scheduling/DailySchedule";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

const JobScheduling: React.FC = () => {
  const [selectedGroup, setSelectedGroup] = useState<SchedulingGroup | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string>("0"); // Default to first day
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  const queryClient = useQueryClient();
  
  // Get the next 5 days starting from today
  const nextFiveDays = Array.from({ length: 5 }, (_, i) => {
    return addDays(new Date(), i);
  });
  
  // Fetch only pending scheduling orders
  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: ['scheduling-orders'],
    queryFn: getPendingSchedulingOrders
  });
  
  // Filter to only include orders that need scheduling (remove already scheduled orders)
  const pendingOrders = orders ? orders.filter(order => 
    order.status === 'scheduled_dates_pending' || 
    order.status === 'pending_approval' ||
    order.status === 'sender_availability_confirmed' ||
    order.status === 'receiver_availability_confirmed'
  ) : [];
  
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
  
  const optimizeRouteMutation = useMutation({
    mutationFn: optimizeRoutes,
    onSuccess: () => {
      toast.success("Routes optimized successfully");
      queryClient.invalidateQueries({ queryKey: ['scheduling-orders'] });
      setIsOptimizing(false);
    },
    onError: (error) => {
      console.error("Optimization error:", error);
      toast.error("Failed to optimize routes");
      setIsOptimizing(false);
    }
  });
  
  // Group only pending orders by the next 5 days based on available dates
  const dateGroupedOrders = pendingOrders.length > 0 ? groupOrdersByDate(pendingOrders, nextFiveDays) : [];
  
  // Get job groups for the currently selected day
  const selectedDayIndex = parseInt(selectedTab);
  const selectedDay = nextFiveDays[selectedDayIndex];
  const selectedDayJobs = dateGroupedOrders[selectedDayIndex] || { 
    date: selectedDay, 
    pickupGroups: [], 
    deliveryGroups: [] 
  };
  
  const handleScheduleGroup = (group: SchedulingGroup) => {
    setSelectedGroup(group);
    setIsDialogOpen(true);
  };
  
  const handleConfirmSchedule = () => {
    if (selectedGroup && scheduleDate) {
      scheduleMutation.mutate({ group: selectedGroup, date: scheduleDate });
    }
  };
  
  const handleOptimizeRoutes = () => {
    setIsOptimizing(true);
    optimizeRouteMutation.mutate(nextFiveDays);
  };
  
  // Handle tab changes
  const handleTabChange = (value: string) => {
    setSelectedTab(value);
  };
  
  if (error) {
    console.error("Error loading orders:", error);
  }

  return (
    <Layout>
      <div className="container py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h1 className="text-3xl font-bold">Job Scheduling</h1>
          <div className="flex space-x-2 mt-2 md:mt-0">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={handleOptimizeRoutes} 
              disabled={isOptimizing || isLoading || pendingOrders.length === 0}
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Optimizing...
                </>
              ) : (
                "Optimize Routes"
              )}
            </Button>
          </div>
        </div>
        
        <SchedulingStats 
          pendingOrdersCount={pendingOrders.length}
          pendingGroupsCount={dateGroupedOrders.reduce(
            (count, day) => count + day.pickupGroups.length + day.deliveryGroups.length, 
            0
          )}
          onRefresh={refetch}
          isLoading={isLoading}
        />
        
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-card rounded-lg p-4 shadow mb-8">
                <h2 className="text-xl font-semibold mb-4">Next 5 Days Schedule</h2>
                
                <Tabs value={selectedTab} onValueChange={handleTabChange}>
                  <TabsList className="mb-4 w-full">
                    {nextFiveDays.map((day, index) => (
                      <TabsTrigger key={index} value={index.toString()}>
                        {format(day, "EEE, MMM d")}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {nextFiveDays.map((day, index) => (
                    <TabsContent key={index} value={index.toString()}>
                      <DailySchedule 
                        dayData={dateGroupedOrders[index] || { date: day, pickupGroups: [], deliveryGroups: [] }}
                        onScheduleGroup={handleScheduleGroup}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </div>
            
            <div className="lg:col-span-1">
              <div className="bg-card rounded-lg shadow">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold">
                    Route Map - {format(selectedDay, "EEEE, MMMM d")}
                  </h3>
                </div>
                <div className="p-4">
                  <RouteMap 
                    pickupGroups={selectedDayJobs.pickupGroups}
                    deliveryGroups={selectedDayJobs.deliveryGroups}
                  />
                </div>
              </div>
            </div>
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
