import React, { useState } from "react";
import { Calendar as CalendarIcon, Navigation } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { optimizeRouteWithGeoapify } from "@/services/routeOptimizationService";
import { useIsMobile } from "@/hooks/use-mobile";

interface Job {
  orderId: string;
  type: 'collection' | 'delivery';
  contactName: string;
  address: string;
  phoneNumber: string;
  estimatedTime?: string;
  order: any;
  lat: number;
  lon: number;
}

interface MultiJobTimeslotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: Job[];
  driverName: string;
  onComplete: () => void;
}

const MultiJobTimeslotDialog: React.FC<MultiJobTimeslotDialogProps> = ({
  open,
  onOpenChange,
  jobs,
  driverName,
  onComplete
}) => {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [jobTimes, setJobTimes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedJobs, setOptimizedJobs] = useState<any[]>([]);

  // Determine if mobile on mount
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-optimize when date is selected
  React.useEffect(() => {
    if (selectedDate && jobs.length > 0) {
      handleOptimizeRoute();
    }
  }, [selectedDate]);

  const handleOptimizeRoute = async () => {
    if (!selectedDate) return;

    setIsOptimizing(true);
    try {
      const optimized = await optimizeRouteWithGeoapify(
        jobs,
        selectedDate,
        "09:00"
      );

      setOptimizedJobs(optimized);
      
      // Auto-populate times from optimized route
      const newJobTimes: Record<string, string> = {};
      optimized.forEach(job => {
        newJobTimes[job.orderId] = job.estimatedArrivalTime;
      });
      setJobTimes(newJobTimes);

      toast.success(`Route optimized! ${optimized.length} stops in optimal sequence`);
    } catch (error: any) {
      console.error('Route optimization error:', error);
      toast.error(`Failed to optimize route: ${error.message}`);
      setOptimizedJobs(jobs); // Fallback to original order
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSendTimeslots = async () => {
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }

    const missingTimes = jobs.filter(job => !jobTimes[job.orderId]);
    if (missingTimes.length > 0) {
      toast.error(`Please set times for all ${jobs.length} jobs`);
      return;
    }

    setIsLoading(true);
    try {
      let successCount = 0;
      let whatsappFailures = 0;
      let emailFailures = 0;
      let shipdayFailures = 0;

      for (const job of jobs) {
        const recipientType = job.type === 'collection' ? 'sender' : 'receiver';
        
        // Parse selected date in local timezone
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hours, minutes] = jobTimes[job.orderId].split(':').map(Number);
        const scheduledDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

        // Update database with timeslot and scheduled date
        const updateField = job.type === 'collection' ? 'pickup_timeslot' : 'delivery_timeslot';
        const dateField = job.type === 'collection' ? 'scheduled_pickup_date' : 'scheduled_delivery_date';

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            [updateField]: jobTimes[job.orderId],
            [dateField]: scheduledDateTime.toISOString()
          })
          .eq('id', job.orderId);

        if (updateError) {
          console.error(`Failed to save timeslot for ${job.contactName}:`, updateError);
          continue;
        }

        // Also update order status appropriately
        const newStatus = job.type === 'collection' ? 'collection_scheduled' : 'delivery_scheduled';
        await supabase
          .from('orders')
          .update({ status: newStatus })
          .eq('id', job.orderId);
        
        const { data, error } = await supabase.functions.invoke('send-timeslot-whatsapp', {
          body: {
            orderId: job.orderId,
            recipientType: recipientType,
            deliveryTime: jobTimes[job.orderId]
          }
        });

        if (!error && data?.results) {
          if (data.results.whatsapp?.success || data.results.shipday?.success || data.results.email?.success) {
            successCount++;
          }
          if (!data.results.whatsapp?.success) whatsappFailures++;
          if (!data.results.email?.success) emailFailures++;
          if (!data.results.shipday?.success) shipdayFailures++;
        }
      }

      // Show summary
      if (successCount === jobs.length) {
        toast.success(`Successfully sent timeslots for ${jobs.length} jobs`);
      } else if (successCount > 0) {
        toast.success(`Partially successful: ${successCount}/${jobs.length} jobs sent`);
        if (whatsappFailures > 0) toast.warning(`${whatsappFailures} WhatsApp failures`);
        if (emailFailures > 0) toast.warning(`${emailFailures} Email failures`);
        if (shipdayFailures > 0) toast.warning(`${shipdayFailures} Shipday failures`);
      } else {
        toast.error(`Failed to send timeslots`);
      }

      onComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending timeslots:', error);
      toast.error(`Failed to send timeslots: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const displayJobs = optimizedJobs.length > 0 ? optimizedJobs : jobs;
  const collectionJobs = displayJobs
    .filter(j => j.type === 'collection')
    .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));
  const deliveryJobs = displayJobs
    .filter(j => j.type === 'delivery')
    .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));

  const content = (
    <>
      <div className="space-y-3">
        {/* Date Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal text-sm h-10",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">{selectedDate ? format(selectedDate, "PPP") : "Pick a date"}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Optimization Status */}
        {isOptimizing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            Optimizing route...
          </div>
        )}

        {/* Collections */}
        {collectionJobs.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-green-700 dark:text-green-400">
              Collections ({collectionJobs.length})
            </h3>
            {collectionJobs.map((job) => (
              <Card key={job.orderId} className="p-2 bg-green-50 dark:bg-green-950/20">
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {job.sequenceOrder !== undefined && (
                          <Badge variant="outline" className="bg-background text-xs px-1.5 py-0 flex-shrink-0">
                            #{job.sequenceOrder}
                          </Badge>
                        )}
                        <p className="font-medium text-xs truncate">{job.contactName}</p>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 break-words">{job.address}</p>
                      {job.timeslotWindow && (
                        <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                          {job.timeslotWindow}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-xs whitespace-nowrap flex-shrink-0">
                      Collect
                    </Badge>
                  </div>
                  <Input
                    type="time"
                    value={jobTimes[job.orderId] || ''}
                    onChange={(e) => setJobTimes(prev => ({ ...prev, [job.orderId]: e.target.value }))}
                    className="w-full h-9 text-sm"
                  />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Deliveries */}
        {deliveryJobs.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-blue-700 dark:text-blue-400">
              Deliveries ({deliveryJobs.length})
            </h3>
            {deliveryJobs.map((job) => (
              <Card key={job.orderId} className="p-2 bg-blue-50 dark:bg-blue-950/20">
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {job.sequenceOrder !== undefined && (
                          <Badge variant="outline" className="bg-background text-xs px-1.5 py-0 flex-shrink-0">
                            #{job.sequenceOrder}
                          </Badge>
                        )}
                        <p className="font-medium text-xs truncate">{job.contactName}</p>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 break-words">{job.address}</p>
                      {job.timeslotWindow && (
                        <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                          {job.timeslotWindow}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-xs whitespace-nowrap flex-shrink-0">
                      Deliver
                    </Badge>
                  </div>
                  <Input
                    type="time"
                    value={jobTimes[job.orderId] || ''}
                    onChange={(e) => setJobTimes(prev => ({ ...prev, [job.orderId]: e.target.value }))}
                    className="w-full h-9 text-sm"
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );

  const footer = (
    <div className="flex flex-col-reverse sm:flex-row gap-2 w-full">
      <Button 
        variant="outline" 
        onClick={() => onOpenChange(false)} 
        disabled={isLoading}
        className="w-full sm:flex-1"
      >
        Cancel
      </Button>
      <Button
        onClick={handleSendTimeslots}
        disabled={isLoading || !selectedDate || Object.keys(jobTimes).length !== jobs.length}
        className="w-full sm:flex-1"
      >
        {isLoading ? "Sending..." : `Send (${jobs.length})`}
      </Button>
    </div>
  );

  // Don't render until we know if mobile or not
  if (isMobile === undefined) {
    return null;
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] overflow-hidden">
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle className="flex items-center gap-2 text-base">
              <Navigation className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Route Timeslots</span>
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              {jobs.length} jobs ({collectionJobs.length} col, {deliveryJobs.length} del)
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="overflow-y-auto overflow-x-hidden px-4 pb-2">
            {content}
          </div>

          <DrawerFooter className="pt-2 px-4 pb-4">
            {footer}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-4 w-4" />
            Optimized Route for {driverName}
          </DialogTitle>
          <DialogDescription>
            {jobs.length} jobs ({collectionJobs.length} collections, {deliveryJobs.length} deliveries)
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {content}
        </div>

        <DialogFooter>
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MultiJobTimeslotDialog;
