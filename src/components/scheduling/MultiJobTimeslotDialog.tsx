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
  const isMobile = useIsMobile();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [jobTimes, setJobTimes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedJobs, setOptimizedJobs] = useState<any[]>([]);

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
      for (const job of jobs) {
        const recipientType = job.type === 'collection' ? 'sender' : 'receiver';
        
        await supabase.functions.invoke('send-timeslot-whatsapp', {
          body: {
            orderId: job.orderId,
            recipientType: recipientType,
            deliveryTime: jobTimes[job.orderId]
          }
        });
      }

      toast.success(`Successfully sent timeslots for ${jobs.length} jobs`);
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
      <div className="space-y-3 px-1">
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
              <Card key={job.orderId} className="p-2.5 bg-green-50 dark:bg-green-950/20">
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {job.sequenceOrder !== undefined && (
                          <Badge variant="outline" className="bg-background text-xs px-1.5 py-0">
                            #{job.sequenceOrder}
                          </Badge>
                        )}
                        <p className="font-medium text-xs truncate">{job.contactName}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{job.address}</p>
                      {job.timeslotWindow && (
                        <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                          Window: {job.timeslotWindow}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-xs whitespace-nowrap">Collection</Badge>
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
              <Card key={job.orderId} className="p-2.5 bg-blue-50 dark:bg-blue-950/20">
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {job.sequenceOrder !== undefined && (
                          <Badge variant="outline" className="bg-background text-xs px-1.5 py-0">
                            #{job.sequenceOrder}
                          </Badge>
                        )}
                        <p className="font-medium text-xs truncate">{job.contactName}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{job.address}</p>
                      {job.timeslotWindow && (
                        <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                          Window: {job.timeslotWindow}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-xs whitespace-nowrap">Delivery</Badge>
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
    <div className="flex flex-col sm:flex-row gap-2 w-full">
      <Button 
        variant="outline" 
        onClick={() => onOpenChange(false)} 
        disabled={isLoading}
        className="w-full sm:w-auto"
      >
        Cancel
      </Button>
      <Button
        onClick={handleSendTimeslots}
        disabled={isLoading || !selectedDate || Object.keys(jobTimes).length !== jobs.length}
        className="w-full sm:w-auto"
      >
        {isLoading ? "Sending..." : `Send Timeslots (${jobs.length})`}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2 text-base">
              <Navigation className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Route Timeslots</span>
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              {jobs.length} jobs ({collectionJobs.length} collections, {deliveryJobs.length} deliveries)
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="overflow-y-auto px-4 pb-4">
            {content}
          </div>

          <DrawerFooter className="pt-2">
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
