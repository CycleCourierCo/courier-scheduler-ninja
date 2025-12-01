import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Send, Route, GripVertical, Plus, Coffee, Edit3, Calendar, Package, PackageX } from "lucide-react";
import { OrderData } from "@/pages/JobScheduling";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDraggable } from "@/hooks/useDraggable";
import { useDroppable } from "@/hooks/useDroppable";
import TimeslotEditDialog from './TimeslotEditDialog';
import { z } from "zod";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Location grouping radius for consolidating messages (in meters)
const LOCATION_GROUPING_RADIUS_METERS = 750;

// Coordinate validation schema
const coordinateSchema = z.object({
  lat: z.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
  lon: z.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180")
});

interface SelectedJob {
  orderId: string;
  type: 'pickup' | 'delivery' | 'break';
  address: string;
  contactName: string;
  phoneNumber: string;
  order: number;
  orderData?: OrderData; // The full order data for accessing bikeQuantity
  estimatedTime?: string;
  actualTime?: string;
  lat?: number;
  lon?: number;
  breakDuration?: number; // Duration in minutes for breaks
  breakType?: 'lunch' | 'stop';
  locationGroupId?: string; // Groups jobs at the same location
  isGroupedLocation?: boolean; // Indicates if this job is part of a grouped location
  groupOrder?: number; // Order within the group at the same location
}

interface RouteBuilderProps {
  orders: OrderData[];
}

  // JobItem component interface and component for drag and drop functionality
interface JobItemProps {
  job: SelectedJob;
  index: number;
  onReorder: (dragIndex: number, hoverIndex: number) => void;
  onAddBreak: (afterIndex: number, breakType: 'lunch' | 'stop') => void;
  onRemove: (job: SelectedJob) => void;
  onSendTimeslot: (job: SelectedJob) => void;
  onSendGroupedTimeslots?: (locationGroupId: string) => void;
  onUpdateCoordinates: (job: SelectedJob, lat: number, lon: number) => void;
  isSendingTimeslots: boolean;
  allJobs: SelectedJob[]; // To check for grouped locations
  bikeCount: number; // Current bike count at this stop
  startingBikes: number; // Starting bike count
  selectedDate: Date; // NEW: Pass the selected date for availability comparison
}

// Helper function to get availability badge
const getAvailabilityBadge = (
  jobType: 'pickup' | 'delivery' | 'break',
  selectedDate: Date | undefined,
  pickupDates?: string[] | null,
  deliveryDates?: string[] | null
): { text: string; color: string } | null => {
  if (!selectedDate || jobType === 'break') return null;
  
  const relevantDates = jobType === 'pickup' ? pickupDates : deliveryDates;
  
  if (!relevantDates || relevantDates.length === 0) {
    return {
      text: 'No Dates Provided',
      color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
    };
  }
  
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const isMatch = relevantDates.some(date => {
    const customerDateStr = format(new Date(date), 'yyyy-MM-dd');
    return customerDateStr === selectedDateStr;
  });
  
  if (isMatch) {
    return {
      text: 'Customer Available',
      color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
    };
  } else {
    return {
      text: 'Not Customer Date',
      color: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
    };
  }
};

// Helper function to get collection status badge
const getCollectionStatusBadge = (
  collectionConfirmedAt?: string | null
): { text: string; color: string; icon: JSX.Element } | null => {
  if (collectionConfirmedAt) {
    return {
      text: 'Collected',
      color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
      icon: <Package className="h-3 w-3" />
    };
  } else {
    return {
      text: 'Not Collected',
      color: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
      icon: <PackageX className="h-3 w-3" />
    };
  }
};

const JobItem: React.FC<JobItemProps> = ({ 
  job, 
  index, 
  onReorder, 
  onAddBreak, 
  onRemove, 
  onSendTimeslot, 
  onSendGroupedTimeslots,
  onUpdateCoordinates,
  isSendingTimeslots,
  allJobs,
  bikeCount,
  startingBikes,
  selectedDate
}) => {
  const { dragRef, isDragging } = useDraggable({
    type: 'job',
    item: { job, index }
  });

  const { dropRef } = useDroppable({
    accept: 'job',
    onDrop: (item: { job: SelectedJob; index: number }) => {
      if (item.index !== index) {
        onReorder(item.index, index);
      }
    }
  });

  // Combine refs for drag and drop
  const combinedRef = (el: HTMLDivElement | null) => {
    if (dragRef) dragRef.current = el;
    if (dropRef) dropRef.current = el;
  };

  // Check if this job is part of a group and get all jobs in the same group
  const groupedJobs = job.isGroupedLocation && job.locationGroupId 
    ? allJobs.filter(j => j.locationGroupId === job.locationGroupId && j.type !== 'break')
    : [job];

  // Only render the card for the first job in a group (to avoid duplicates)
  const isFirstInGroup = !job.isGroupedLocation || job.groupOrder === 1;
  
  if (!isFirstInGroup) {
    return null; // Don't render duplicate cards for grouped jobs
  }

  return (
    <div className="space-y-2">
      <div 
        ref={combinedRef}
        className={`flex items-start justify-between p-2 bg-background border rounded-lg transition-opacity ${
          isDragging ? 'opacity-50' : ''
        } hover:shadow-md cursor-move gap-2`}
      >
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0 mt-0.5" />
          <Badge variant="outline" className="flex-shrink-0 text-xs">#{job.order}</Badge>
          <div className="flex-1 min-w-0">
            {groupedJobs.length > 1 ? (
              // Multiple jobs at same location
              <div className="space-y-1.5">
                <p className="text-xs font-medium">📍 Multiple stops</p>
                <p className="text-xs text-muted-foreground line-clamp-1 break-words">{job.address}</p>
                <div className="space-y-1">
                  {(() => {
                    // Sort grouped jobs: deliveries first, then pickups
                    const sortedJobs = [...groupedJobs].sort((a, b) => {
                      if (a.type === 'delivery' && b.type === 'pickup') return -1;
                      if (a.type === 'pickup' && b.type === 'delivery') return 1;
                      return 0;
                    });
                    
                    // Calculate the actual starting bike count for this grouped stop
                    // bikeCount is the final count AFTER the entire stop, so work backwards
                    const totalDeliveries = groupedJobs
                      .filter(j => j.type === 'delivery')
                      .reduce((sum, j) => sum + (j.orderData?.bike_quantity || 1), 0);
                    const totalPickups = groupedJobs
                      .filter(j => j.type === 'pickup')
                      .reduce((sum, j) => sum + (j.orderData?.bike_quantity || 1), 0);
                    
                    let runningBikeCount = bikeCount + totalDeliveries - totalPickups;
                    
                    return sortedJobs.map((groupedJob, idx) => {
                      const quantity = groupedJob.orderData?.bike_quantity || 1;
                      
                      // Calculate bike count after this job
                      if (groupedJob.type === 'delivery') {
                        runningBikeCount -= quantity;
                      } else if (groupedJob.type === 'pickup') {
                        runningBikeCount += quantity;
                      }
                      
                      const bikeCountAfterJob = runningBikeCount;
                      
                      // Get badges for this grouped job
                      const availabilityBadge = getAvailabilityBadge(
                        groupedJob.type,
                        selectedDate,
                        groupedJob.orderData?.pickup_date,
                        groupedJob.orderData?.delivery_date
                      );
                      
                      const collectionBadge = groupedJob.type === 'delivery' 
                        ? getCollectionStatusBadge(groupedJob.orderData?.collection_confirmation_sent_at)
                        : null;
                    
                      return (
                        <div key={`${groupedJob.orderId}-${groupedJob.type}`} className="space-y-1 pl-1.5 border-l border-muted">
                          {/* Job info row */}
                          <div className="flex items-center gap-1 flex-wrap">
                            <Badge variant={groupedJob.type === 'pickup' ? 'default' : 'secondary'} className="text-xs px-1 py-0">
                              {groupedJob.type === 'pickup' ? 'Col' : 'Del'}
                            </Badge>
                            <span className="text-xs font-medium truncate">{groupedJob.contactName}</span>
                            <Badge variant="outline" className="text-xs bg-green-100 text-green-800 px-1 py-0 whitespace-nowrap">
                              🚲 {bikeCountAfterJob}
                            </Badge>
                          </div>
                          
                          {/* Badges row */}
                          <div className="flex gap-1 flex-wrap">
                            {availabilityBadge && (
                              <Badge className={`text-xs px-1.5 py-0 ${availabilityBadge.color}`}>
                                {availabilityBadge.text}
                              </Badge>
                            )}
                            {collectionBadge && (
                              <Badge className={`text-xs px-1.5 py-0 flex items-center gap-1 ${collectionBadge.color}`}>
                                {collectionBadge.icon}
                                {collectionBadge.text}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              // Single job
              <div className="space-y-0.5">
                <p className="text-xs font-medium truncate">{job.contactName}</p>
                <p className="text-xs text-muted-foreground line-clamp-1 break-words">{job.address}</p>
                <div className="flex gap-1 flex-wrap items-center">
                  {job.type === 'break' ? (
                    <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0">
                      {job.breakType === 'lunch' ? '🍽️ Lunch' : '☕ Stop'} ({job.breakDuration}min)
                    </Badge>
                  ) : (
                    <>
                      {/* Job Type Badge */}
                      <Badge variant={job.type === 'pickup' ? 'default' : 'secondary'} className="text-xs px-1.5 py-0">
                        {job.type === 'pickup' ? 'Collection' : 'Delivery'}
                      </Badge>
                      
                      {/* Bike Count Badge */}
                      <Badge variant="outline" className="text-xs bg-green-100 text-green-800 px-1.5 py-0 whitespace-nowrap">
                        🚲 {bikeCount}
                      </Badge>
                      
                      {/* Availability Badge */}
                      {(() => {
                        const availabilityBadge = getAvailabilityBadge(
                          job.type,
                          selectedDate,
                          job.orderData?.pickup_date,
                          job.orderData?.delivery_date
                        );
                        return availabilityBadge ? (
                          <Badge className={`text-xs px-1.5 py-0 ${availabilityBadge.color}`}>
                            {availabilityBadge.text}
                          </Badge>
                        ) : null;
                      })()}
                      
                      {/* Collection Status Badge (only for deliveries) */}
                      {job.type === 'delivery' && (() => {
                        const collectionBadge = getCollectionStatusBadge(job.orderData?.collection_confirmation_sent_at);
                        return collectionBadge ? (
                          <Badge className={`text-xs px-1.5 py-0 flex items-center gap-1 ${collectionBadge.color}`}>
                            {collectionBadge.icon}
                            {collectionBadge.text}
                          </Badge>
                        ) : null;
                      })()}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {job.estimatedTime && (
            <Badge variant="outline" className="flex items-center gap-1 text-xs px-1.5 py-0">
              <Clock className="h-3 w-3" />
              {job.estimatedTime}
            </Badge>
          )}
          
          <div className="flex flex-wrap gap-1 justify-end">
            {job.type !== 'break' && !job.lat && !job.lon && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const lat = prompt('Enter latitude:');
                  const lon = prompt('Enter longitude:');
                  if (lat && lon && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
                    onUpdateCoordinates(job, Number(lat), Number(lon));
                  }
                }}
                className="flex items-center gap-1 text-orange-600 hover:text-orange-700 h-7 text-xs px-2"
              >
                <Edit3 className="h-3 w-3" />
                Coords
              </Button>
            )}
            
            {job.type !== 'break' && (job.lat && job.lon) && (
              <>
                {groupedJobs.length > 1 ? (
                  // Individual send buttons for each job in the group
                  groupedJobs.map((groupedJob) => (
                    <Button
                      key={`${groupedJob.orderId}-${groupedJob.type}`}
                      size="sm"
                      onClick={() => onSendTimeslot(groupedJob)}
                      disabled={isSendingTimeslots || !groupedJob.estimatedTime}
                      className="flex items-center gap-1 text-xs h-7 px-2"
                    >
                      <Send className="h-3 w-3" />
                      {groupedJob.type === 'pickup' ? 'Col' : 'Del'}
                    </Button>
                  ))
                ) : (
                  // Single job send button
                  <Button
                    size="sm"
                    onClick={() => onSendTimeslot(job)}
                    disabled={isSendingTimeslots || !job.estimatedTime}
                    className="flex items-center gap-1 h-7 text-xs px-2"
                  >
                    <Send className="h-3 w-3" />
                    Send
                  </Button>
                )}
                
                {job.isGroupedLocation && job.locationGroupId && onSendGroupedTimeslots && 
                 allJobs.filter(j => j.locationGroupId === job.locationGroupId && j.type !== 'break').length > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSendGroupedTimeslots!(job.locationGroupId!)}
                    disabled={isSendingTimeslots || !job.estimatedTime}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 h-7 text-xs px-2"
                  >
                    <Send className="h-3 w-3" />
                    All
                  </Button>
                )}
              </>
            )}
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRemove(job)}
              className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
            >
              ×
            </Button>
          </div>
        </div>
      </div>
      
      {/* Add break buttons after each job - only show if not at Lawden Road */}
      {!job.address.toLowerCase().includes('lawden road') && (
        <div className="flex gap-1 ml-6">
          <Button 
            onClick={() => onAddBreak(index, 'lunch')} 
            variant="ghost" 
            size="sm"
            className="text-xs h-6 px-2"
          >
            + Lunch
          </Button>
          <Button 
            onClick={() => onAddBreak(index, 'stop')} 
            variant="ghost" 
            size="sm"
            className="text-xs h-6 px-2"
          >
            + Stop
          </Button>
        </div>
      )}
    </div>
  );
};

const RouteBuilder: React.FC<RouteBuilderProps> = ({ orders }) => {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);
  const [selectedJobs, setSelectedJobs] = useState<SelectedJob[]>([]);
  const [orderList, setOrderList] = useState<OrderData[]>(orders);
  const [showTimeslotDialog, setShowTimeslotDialog] = useState(false);
  const [showCoordinateDialog, setShowCoordinateDialog] = useState(false);
  const [coordinateJobToUpdate, setCoordinateJobToUpdate] = useState<{orderId: string, type: 'pickup' | 'delivery', contactName: string, address: string} | null>(null);
  const [coordinateInputs, setCoordinateInputs] = useState({ lat: '', lon: '' });
  const [startTime, setStartTime] = useState("09:00");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startingBikes, setStartingBikes] = useState<number>(0);
  const [isSendingTimeslots, setIsSendingTimeslots] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<SelectedJob | null>(null);
  const [isSendingTimeslip, setIsSendingTimeslip] = useState(false);

  // Detect mobile on mount
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate optimal starting bike count based on route
  const calculateOptimalStartingBikes = (): number => {
    if (selectedJobs.length === 0) return 0;
    
    // Group jobs by order ID to identify orders with both pickup and delivery
    const orderGroups: { [orderId: string]: SelectedJob[] } = {};
    selectedJobs.forEach(job => {
      if (!orderGroups[job.orderId]) {
        orderGroups[job.orderId] = [];
      }
      orderGroups[job.orderId].push(job);
    });
    
    // Only count deliveries that don't have a corresponding pickup in the same route
    let startingBikes = 0;
    Object.values(orderGroups).forEach(jobs => {
      const hasPickup = jobs.some(job => job.type === 'pickup');
      const deliveryJobs = jobs.filter(job => job.type === 'delivery');
      
      // If this order doesn't have a pickup in the route, count its delivery bikes
      if (!hasPickup) {
        deliveryJobs.forEach(job => {
          const quantity = job.orderData?.bike_quantity || 1;
          startingBikes += quantity;
        });
      }
    });
    
    return startingBikes;
  };

  // Auto-update starting bikes when route changes
  React.useEffect(() => {
    const optimalStarting = calculateOptimalStartingBikes();
    setStartingBikes(optimalStarting);
  }, [selectedJobs]);

  // Helper function to calculate bike count AFTER a given job is completed
  const calculateBikeCountAtJob = (jobIndex: number): number => {
    let bikeCount = startingBikes;
    
    // Include the current job (jobIndex) in the calculation to show count AFTER this stop
    for (let i = 0; i <= jobIndex; i++) {
      const job = selectedJobs[i];
      if (job.type === 'delivery') {
        // After a delivery, subtract the bike quantity for this order
        const quantity = job.orderData?.bike_quantity || 1;
        bikeCount -= quantity;
      } else if (job.type === 'pickup') {
        // After a pickup, add the bike quantity for this order
        const quantity = job.orderData?.bike_quantity || 1;
        bikeCount += quantity;
      }
      // Breaks don't affect bike count
    }
    
    return bikeCount;
  };

  // Calculate final bike count
  const calculateFinalBikeCount = (): number => {
    let bikeCount = startingBikes;
    
    for (const job of selectedJobs) {
      if (job.type === 'delivery') {
        // After a delivery, subtract the bike quantity for this order
        const quantity = job.orderData?.bike_quantity || 1;
        bikeCount -= quantity;
      } else if (job.type === 'pickup') {
        // After a pickup, add the bike quantity for this order
        const quantity = job.orderData?.bike_quantity || 1;
        bikeCount += quantity;
      }
    }
    
    return bikeCount;
  };

  const getJobsFromOrders = () => {
    const jobs: Array<{ 
      orderId: string; 
      type: 'pickup' | 'delivery'; 
      address: string; 
      contactName: string; 
      phoneNumber: string; 
      order: OrderData;
      lat?: number;
      lon?: number;
    }> = [];
    
    orderList.forEach(order => {
      // Add pickup job if not scheduled
      if (!order.scheduled_pickup_date) {
        jobs.push({
          orderId: order.id,
          type: 'pickup',
          address: formatAddress(order.sender.address),
          contactName: order.sender.name,
          phoneNumber: order.sender.phone,
          order,
          lat: order.sender.address.lat,
          lon: order.sender.address.lon
        });
      }
      
      // Add delivery job if not scheduled
      if (!order.scheduled_delivery_date) {
        jobs.push({
          orderId: order.id,
          type: 'delivery',
          address: formatAddress(order.receiver.address),
          contactName: order.receiver.name,
          phoneNumber: order.receiver.phone,
          order,
          lat: order.receiver.address.lat,
          lon: order.receiver.address.lon
        });
      }
    });
    
    return jobs;
  };

  const updateAvailableJobCoordinates = async (orderId: string, type: 'pickup' | 'delivery', lat: number, lon: number) => {
    try {
      // Validate coordinates
      coordinateSchema.parse({ lat, lon });
      
      // Update in database
      const addressField = type === 'pickup' ? 'sender' : 'receiver';
      const { data: existingOrder, error: fetchError } = await supabase
        .from('orders')
        .select(addressField)
        .eq('id', orderId)
        .single();

      if (fetchError) {
        throw new Error('Failed to fetch existing order');
      }

      const updatedAddress = {
        ...existingOrder[addressField],
        address: {
          ...existingOrder[addressField].address,
          lat,
          lon
        }
      };

      const { error: updateError } = await supabase
        .from('orders')
        .update({ [addressField]: updatedAddress })
        .eq('id', orderId);

      if (updateError) {
        throw new Error('Failed to update coordinates in database');
      }

      // Update local state
      const updatedOrders = orderList.map(order => {
        if (order.id === orderId) {
          const updatedOrder = { ...order };
          if (type === 'pickup') {
            updatedOrder.sender = {
              ...updatedOrder.sender,
              address: {
                ...updatedOrder.sender.address,
                lat,
                lon
              }
            };
          } else {
            updatedOrder.receiver = {
              ...updatedOrder.receiver,
              address: {
                ...updatedOrder.receiver.address,
                lat,
                lon
              }
            };
          }
          return updatedOrder;
        }
        return order;
      });
      
      setOrderList(updatedOrders);
      toast.success('Coordinates updated successfully');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.issues[0].message);
      } else {
        toast.error('Failed to update coordinates: ' + (error as Error).message);
      }
    }
  };

  const openCoordinateDialog = (orderId: string, type: 'pickup' | 'delivery', contactName: string, address: string) => {
    setCoordinateJobToUpdate({ orderId, type, contactName, address });
    setCoordinateInputs({ lat: '', lon: '' });
    setShowCoordinateDialog(true);
  };

  const handleCoordinateUpdate = () => {
    if (!coordinateJobToUpdate) return;
    
    const lat = parseFloat(coordinateInputs.lat.trim());
    const lon = parseFloat(coordinateInputs.lon.trim());
    
    if (isNaN(lat) || isNaN(lon)) {
      toast.error('Please enter valid numbers for coordinates');
      return;
    }
    
    updateAvailableJobCoordinates(coordinateJobToUpdate.orderId, coordinateJobToUpdate.type, lat, lon);
    setShowCoordinateDialog(false);
    setCoordinateJobToUpdate(null);
  };

  const formatAddress = (address: any) => {
    // Ensure all components exist and handle missing values
    const street = address.street || '';
    const city = address.city || '';
    const state = address.state || '';
    const zipCode = address.zipCode || '';
    const country = address.country || 'United Kingdom';
    
    // Filter out empty components and join with commas
    const components = [street, city, state, zipCode, country].filter(Boolean);
    return components.join(', ');
  };

  const toggleJobSelection = (job: any) => {
    const isSelected = selectedJobs.some(j => j.orderId === job.orderId && j.type === job.type);
    
    if (isSelected) {
      setSelectedJobs(prev => prev.filter(j => !(j.orderId === job.orderId && j.type === job.type)));
    } else {
      const newJob: SelectedJob = {
        orderId: job.orderId,
        type: job.type as 'pickup' | 'delivery',
        address: job.address,
        contactName: job.contactName,
        orderData: job.order, // Include the full order data
        phoneNumber: job.phoneNumber,
        order: selectedJobs.length + 1,
        lat: job.lat,
        lon: job.lon
      };
      setSelectedJobs(prev => [...prev, newJob]);
      // Starting bikes will auto-update via useEffect
    }
  };

  const reorderJobs = (dragIndex: number, hoverIndex: number) => {
    const reorderedJobs = [...selectedJobs];
    const draggedJob = reorderedJobs[dragIndex];
    reorderedJobs.splice(dragIndex, 1);
    reorderedJobs.splice(hoverIndex, 0, draggedJob);
    
    // Update order numbers
    const updatedJobs = reorderedJobs.map((job, index) => ({
      ...job,
      order: index + 1
    }));
    
    setSelectedJobs(updatedJobs);
    // Starting bikes will auto-update via useEffect
  };

  const addBreak = (afterIndex: number, breakType: 'lunch' | 'stop') => {
    const newBreak: SelectedJob = {
      orderId: `break-${Date.now()}`,
      type: 'break',
      address: breakType === 'lunch' ? 'Lunch Break' : 'Stop Break',
      contactName: breakType === 'lunch' ? 'Lunch Break' : 'Stop Break',
      phoneNumber: '',
      order: afterIndex + 2,
      breakDuration: breakType === 'lunch' ? 60 : 15, // 60 min for lunch, 15 min for stop
      breakType
    };

    const updatedJobs = [...selectedJobs];
    updatedJobs.splice(afterIndex + 1, 0, newBreak);
    
    // Update order numbers for all jobs after the inserted break
    const reorderedJobs = updatedJobs.map((job, index) => ({
      ...job,
      order: index + 1
    }));
    
    setSelectedJobs(reorderedJobs);
    // Starting bikes will auto-update via useEffect
  };

  const removeJob = (jobToRemove: SelectedJob) => {
    const updatedJobs = selectedJobs
      .filter(job => !(job.orderId === jobToRemove.orderId && job.type === jobToRemove.type))
      .map((job, index) => ({
        ...job,
        order: index + 1
      }));
    setSelectedJobs(updatedJobs);
    // Starting bikes will auto-update via useEffect
  };

  const updateCoordinates = async (jobToUpdate: SelectedJob, lat: number, lon: number) => {
    try {
      // Only update database for pickup/delivery jobs, not breaks
      if (jobToUpdate.type !== 'break') {
        await updateAvailableJobCoordinates(jobToUpdate.orderId, jobToUpdate.type, lat, lon);
      }
      
      // Update selected jobs list
      const updatedJobs = selectedJobs.map(job => 
        (job.orderId === jobToUpdate.orderId && job.type === jobToUpdate.type) 
          ? { ...job, lat, lon }
          : job
      );
      setSelectedJobs(updatedJobs);
    } catch (error) {
      // Error already handled in updateAvailableJobCoordinates
    }
  };

  const roundTimeToNext5Minutes = (date: Date): Date => {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 5) * 5;
    const newDate = new Date(date);
    
    if (roundedMinutes === 60) {
      newDate.setHours(newDate.getHours() + 1);
      newDate.setMinutes(0);
    } else {
      newDate.setMinutes(roundedMinutes);
    }
    
    return newDate;
  };

  // Helper function to check if two coordinates are the same location (within 50 meters)
  const isSameLocation = (coords1: { lat: number; lon: number }, coords2: { lat: number; lon: number }): boolean => {
    const earthRadius = 6371000; // Earth's radius in meters
    const lat1Rad = coords1.lat * Math.PI / 180;
    const lat2Rad = coords2.lat * Math.PI / 180;
    const deltaLatRad = (coords2.lat - coords1.lat) * Math.PI / 180;
    const deltaLonRad = (coords2.lon - coords1.lon) * Math.PI / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) *
      Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadius * c;

    return distance <= LOCATION_GROUPING_RADIUS_METERS; // Within 750 meters
  };

  // Helper function to group jobs by location
  const groupJobsByLocation = (jobs: SelectedJob[]): SelectedJob[] => {
    const routeJobs = jobs.filter(job => job.type !== 'break');
    const breaks = jobs.filter(job => job.type === 'break');
    const groupedJobs: SelectedJob[] = [];
    
    // Group jobs by location
    const locationGroups: { [key: string]: SelectedJob[] } = {};
    
    routeJobs.forEach(job => {
      if (!job.lat || !job.lon) return;
      
      // Find existing group with same location
      let groupId = null;
      for (const [existingGroupId, existingJobs] of Object.entries(locationGroups)) {
        const firstJobInGroup = existingJobs[0];
        if (firstJobInGroup.lat && firstJobInGroup.lon && 
            isSameLocation({ lat: job.lat, lon: job.lon }, { lat: firstJobInGroup.lat, lon: firstJobInGroup.lon })) {
          groupId = existingGroupId;
          break;
        }
      }
      
      // Create new group if no existing group found
      if (!groupId) {
        groupId = `location-${job.lat}-${job.lon}-${Date.now()}`;
        locationGroups[groupId] = [];
      }
      
      // Add job to group with group metadata
      const jobWithGroup: SelectedJob = {
        ...job,
        locationGroupId: groupId,
        isGroupedLocation: true,
        groupOrder: locationGroups[groupId].length + 1
      };
      
      locationGroups[groupId].push(jobWithGroup);
    });
    
    // Rebuild the jobs list maintaining original order but with group information
    let breakIndex = 0;
    jobs.forEach(job => {
      if (job.type === 'break') {
        groupedJobs.push(job);
      } else {
        // Find the job in the location groups
        for (const group of Object.values(locationGroups)) {
          const groupedJob = group.find(gj => gj.orderId === job.orderId && gj.type === job.type);
          if (groupedJob) {
            groupedJobs.push(groupedJob);
            break;
          }
        }
      }
    });
    
    return groupedJobs;
  };

  const calculateTimeslots = async () => {
    if (selectedJobs.length === 0) return;

    // Group jobs by location first
    const groupedJobs = groupJobsByLocation(selectedJobs);

    // Filter out breaks for coordinate validation and routing
    const routeJobs = groupedJobs.filter(job => job.type !== 'break');

    // Check for missing coordinates
    const jobsWithoutCoords = routeJobs.filter(job => !job.lat || !job.lon);
    if (jobsWithoutCoords.length > 0) {
      const addressList = jobsWithoutCoords.map(job => `${job.contactName} (${job.address})`).join('\n');
      toast.error(`Missing coordinates for addresses:\n${addressList}\n\nPlease ensure all addresses have latitude/longitude coordinates.`);
      return;
    }

    const baseCoords = { lat: 52.4690197, lon: -1.8757663 }; // Birmingham coordinates for Lawden Road, B10 0AD
    
    try {
      const updatedJobs = [];
      let currentTime = new Date(`2024-01-01 ${startTime}`);
      let lastLocationCoords = baseCoords;
      let processedLocationGroups = new Set<string>();
      
      for (let i = 0; i < groupedJobs.length; i++) {
        const job = groupedJobs[i];
        
        if (job.type === 'break') {
          // For breaks, just add the break duration
          currentTime = new Date(currentTime.getTime() + (job.breakDuration || 15) * 60000);
          const roundedBreakTime = roundTimeToNext5Minutes(currentTime);
          updatedJobs.push({
            ...job,
            estimatedTime: roundedBreakTime.toTimeString().slice(0, 5)
          });
          currentTime = roundedBreakTime;
        } else {
          // Check if this is a grouped location and if we've already calculated travel time for this group
          const isNewLocation = !job.locationGroupId || !processedLocationGroups.has(job.locationGroupId);
          
          if (isNewLocation) {
            // Calculate travel time only for the first job at this location
            const travelTime = await calculateTravelTime(lastLocationCoords, { lat: job.lat!, lon: job.lon! });
            currentTime = new Date(currentTime.getTime() + travelTime * 60000);
            
            // Round to next 5-minute increment for arrival time
            const roundedJobTime = roundTimeToNext5Minutes(currentTime);
            
            // Mark this location group as processed
            if (job.locationGroupId) {
              processedLocationGroups.add(job.locationGroupId);
            }
            
            // Update last location for next calculation
            lastLocationCoords = { lat: job.lat!, lon: job.lon! };
            
            // Set the arrival time for this job
            updatedJobs.push({
              ...job,
              estimatedTime: roundedJobTime.toTimeString().slice(0, 5)
            });
            
            // Add 15 minutes service time for this job
            currentTime = new Date(roundedJobTime.getTime() + 15 * 60000);
          } else {
            // This is a subsequent job at the same location - same arrival time, but add service time
            const arrivalTime = new Date(currentTime.getTime() - 15 * 60000); // Subtract the service time from previous job
            updatedJobs.push({
              ...job,
              estimatedTime: arrivalTime.toTimeString().slice(0, 5)
            });
            
            // Add 15 minutes service time for this additional job
            currentTime = new Date(currentTime.getTime() + 15 * 60000);
          }
        }
      }

      setSelectedJobs(updatedJobs);
      setShowTimeslotDialog(true);
    } catch (error) {
      console.error('Error calculating timeslots:', error);
      toast.error('Failed to calculate timeslots. Please try again.');
      
      // Fallback to mock calculation
      const updatedJobs = selectedJobs.map((job, index) => {
        const startDateTime = new Date(`2024-01-01 ${startTime}`);
        const travelTimeMinutes = (index + 1) * 15; // Mock 15 minutes between stops
        const arrivalTime = new Date(startDateTime.getTime() + travelTimeMinutes * 60000);
        
        return {
          ...job,
          estimatedTime: arrivalTime.toTimeString().slice(0, 5)
        };
      });

      setSelectedJobs(updatedJobs);
      setShowTimeslotDialog(true);
    }
  };

  const calculateTravelTime = async (fromCoords: { lat: number; lon: number }, toCoords: { lat: number; lon: number }): Promise<number> => {
    try {
      const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
      if (!apiKey) {
        console.warn('Geoapify API key not found, using default travel time');
        return 15; // Default 15 minutes
      }

      // Format waypoints as lat,lon pairs separated by pipe
      const waypoints = `${fromCoords.lat},${fromCoords.lon}|${toCoords.lat},${toCoords.lon}`;
      const url = `https://api.geoapify.com/v1/routing?waypoints=${waypoints}&mode=light_truck&type=short&traffic=approximated&format=json&apiKey=${apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Geoapify API error:', response.status, errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        // Return travel time in minutes
        const travelTimeSeconds = data.results[0].time || 900; // Default 15 minutes if not found
        return Math.ceil(travelTimeSeconds / 60);
      } else {
        console.warn('No route found, using default travel time');
        return 15; // Default 15 minutes
      }
    } catch (error) {
      console.error('Error calculating travel time:', error);
      return 15; // Default 15 minutes on error
    }
  };

  const openTimeslotEditDialog = (job: SelectedJob) => {
    if (!job.estimatedTime) return;
    setJobToEdit(job);
    setEditDialogOpen(true);
  };

  const sendTimeslot = async (job: SelectedJob, customTime?: string) => {
    const timeToUse = customTime || job.estimatedTime;
    if (!timeToUse) return;

    setIsSendingTimeslots(true);
    try {
      const deliveryTime = `${timeToUse}:00`;
      
      // Create datetime from selected date and estimated time
      const [hours, minutes] = timeToUse.split(':').map(Number);
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);
      
      // First save the timeslot and scheduled date to the database
      const updateField = job.type === 'pickup' ? 'pickup_timeslot' : 'delivery_timeslot';
      const dateField = job.type === 'pickup' ? 'scheduled_pickup_date' : 'scheduled_delivery_date';
      
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          [updateField]: deliveryTime,
          [dateField]: scheduledDateTime.toISOString()
        })
        .eq('id', job.orderId);

      if (updateError) {
        console.error("Error saving timeslot:", updateError);
        toast.error(`Failed to save timeslot: ${updateError.message}`);
        return;
      }

      // Update order status like in TimeslotSelection component
      let newStatus: any = 'scheduled'; // Default status
      if (job.type === 'pickup') {
        newStatus = "collection_scheduled";
      } else if (job.type === 'delivery') {
        // Check if delivery is on same date as collection
        const order = job.orderData;
        const pickupDate = order?.scheduled_pickup_date;
        
        if (pickupDate && scheduledDateTime) {
          const pickupDateOnly = new Date(pickupDate).toDateString();
          const deliveryDateOnly = scheduledDateTime.toDateString();
          
          if (pickupDateOnly === deliveryDateOnly) {
            newStatus = "scheduled";
          } else {
            newStatus = "delivery_scheduled";
          }
        } else {
          newStatus = "delivery_scheduled";
        }
      }

      // Update the order status
      const { error: statusUpdateError } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', job.orderId);

      if (statusUpdateError) {
        console.error("Error updating order status:", statusUpdateError);
        toast.error(`Failed to update order status: ${statusUpdateError.message}`);
        return;
      }
      
      // Check if this is a grouped location and send enhanced message
      let message = '';
      if (job.isGroupedLocation && job.locationGroupId) {
        const jobsAtSameLocation = selectedJobs.filter(j => 
          j.locationGroupId === job.locationGroupId && j.type !== 'break'
        );
        
        if (jobsAtSameLocation.length > 1) {
          message = `Multiple ${job.type === 'pickup' ? 'collections' : 'deliveries'} scheduled at this location (${jobsAtSameLocation.length} total)`;
        }
      }
      
      const { data, error } = await supabase.functions.invoke('send-timeslot-whatsapp', {
        body: {
          orderId: job.orderId,
          recipientType: job.type === 'pickup' ? 'sender' : 'receiver',
          deliveryTime,
          customMessage: message
        }
      });

      if (error) {
        console.error("Error sending timeslot:", error);
        toast.error(`Failed to send timeslot: ${error.message}`);
        return;
      }

      // Handle individual operation results
      if (data?.results) {
        const { whatsapp, shipday, email } = data.results;
        if (whatsapp?.success) toast.success("WhatsApp sent");
        if (email?.success) toast.success("Email sent");
        if (shipday?.success) toast.success("Shipday updated");
        if (!whatsapp?.success) toast.error(`WhatsApp failed: ${whatsapp?.error}`);
        if (!email?.success && email?.error) toast.warning(`Email failed: ${email.error}`);
        if (!shipday?.success && shipday?.error) toast.warning(`Shipday failed: ${shipday.error}`);
      } else {
        toast.success("Timeslot sent successfully");
      }

      // Check Shipday status and show appropriate notification like in TimeslotSelection
      if (data?.shipdayStatus === 'failed') {
        toast.success(`Timeslot sent to ${job.contactName} via WhatsApp successfully!`, {
          description: `Note: Shipday update failed (${data.shipdayError}). The timeslot was saved but may need manual update in Shipday.`
        });
      } else if (data?.shipdayStatus === 'no_shipday_id') {
        toast.success(`Timeslot sent to ${job.contactName} via WhatsApp successfully!`, {
          description: "Note: No Shipday order found to update."
        });
      } else {
        toast.success(`Timeslot sent to ${job.contactName}${job.isGroupedLocation ? ' (grouped location)' : ''} successfully!`);
      }
    } catch (error) {
      console.error('Error sending timeslot:', error);
      toast.error(`Failed to send timeslot: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSendingTimeslots(false);
    }
  };

  // New function to send timeslots for all jobs at a grouped location
  const sendGroupedTimeslots = async (locationGroupId: string) => {
    const jobsAtLocation = selectedJobs.filter(job => 
      job.locationGroupId === locationGroupId && job.type !== 'break'
    );
    
    if (jobsAtLocation.length === 0) return;

    setIsSendingTimeslots(true);
    try {
      if (jobsAtLocation.length === 0 || !jobsAtLocation[0].estimatedTime) return;
      
      // Get the primary contact (first job's contact - could be pickup or delivery)
      const primaryJob = jobsAtLocation[0];
      const deliveryTime = `${primaryJob.estimatedTime}:00`;
      
      // Create datetime from selected date and estimated time (local timezone)
      const [jobHours, jobMinutes] = primaryJob.estimatedTime.split(':').map(Number);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const [year, month, day] = dateStr.split('-').map(Number);
      const scheduledDateTime = new Date(year, month - 1, day, jobHours, jobMinutes, 0, 0);
      
      // Separate ALL deliveries and collections at this location
      const deliveries: string[] = [];
      const collections: string[] = [];
      
      jobsAtLocation.forEach(job => {
        const brand = job.orderData?.bike_brand || 'Unknown Brand';
        const model = job.orderData?.bike_model || 'Unknown Model';
        const bikeInfo = `${brand} ${model}`;
        
        if (job.type === 'delivery') {
          deliveries.push(bikeInfo);
        } else if (job.type === 'pickup') {
          collections.push(bikeInfo);
        }
      });
      
      // Format timeslot window (original time + 3 hours)
      const [windowHours, windowMinutes] = primaryJob.estimatedTime.split(':').map(Number);
      const endHour = Math.min(23, windowHours + 3);
      const startTime = `${windowHours.toString().padStart(2, '0')}:${windowMinutes.toString().padStart(2, '0')}`;
      const endTime = `${endHour.toString().padStart(2, '0')}:${windowMinutes.toString().padStart(2, '0')}`;
      const timeWindow = `${startTime} and ${endTime}`;
      
      // Format date
      const formattedDate = format(selectedDate, 'EEEE d MMMM yyyy');
      
      // Create custom message following the requested format - send to primary contact
      let message = `Dear ${primaryJob.contactName},\n\n`;
      message += `We are due to be with you on ${formattedDate} between ${timeWindow} for the following deliveries and collections.\n\n`;
      
      if (deliveries.length > 0) {
        message += `Deliveries: ${deliveries.join(', ')}\n`;
      }
      if (collections.length > 0) {
        message += `Collections: ${collections.join(', ')}\n`;
      }
      
      message += `\nYou will receive a text with a live tracking link once the driver is on his way.\n\n`;
      message += `Please ensure the pedals have been removed from the bikes we are collecting and are in a bag along with any other accessories. Make sure the bag is attached to the bike securely to avoid any loss.\n\n`;
      message += `Thank you!\nCycle Courier Co.`;
      
      // Update ALL jobs at this location
      for (const job of jobsAtLocation) {
        const updateField = job.type === 'pickup' ? 'pickup_timeslot' : 'delivery_timeslot';
        const dateField = job.type === 'pickup' ? 'scheduled_pickup_date' : 'scheduled_delivery_date';
        
        // Update timeslot and scheduled date
        await supabase
          .from('orders')
          .update({ 
            [updateField]: deliveryTime,
            [dateField]: scheduledDateTime.toISOString()
          })
          .eq('id', job.orderId);
          
        // Update status
        let newStatus: any = 'scheduled';
        if (job.type === 'pickup') {
          newStatus = "collection_scheduled";
        } else if (job.type === 'delivery') {
          const order = job.orderData;
          const pickupDate = order?.scheduled_pickup_date;
          
          if (pickupDate && scheduledDateTime) {
            const pickupDateOnly = new Date(pickupDate).toDateString();
            const deliveryDateOnly = scheduledDateTime.toDateString();
            
            if (pickupDateOnly === deliveryDateOnly) {
              newStatus = "scheduled";
            } else {
              newStatus = "delivery_scheduled";
            }
          } else {
            newStatus = "delivery_scheduled";
          }
        }
        
        await supabase
          .from('orders')
          .update({ status: newStatus })
          .eq('id', job.orderId);
      }
      
      // Send ONE consolidated message to the primary contact, but include all related order IDs
      // so that ALL Shipday jobs get updated
      const relatedOrderIds = jobsAtLocation
        .filter(job => job.orderId !== primaryJob.orderId)
        .map(job => job.orderId);
      
      console.log(`Sending consolidated message for primary order ${primaryJob.orderId} with ${relatedOrderIds.length} related orders`);
      
      const { data, error } = await supabase.functions.invoke('send-timeslot-whatsapp', {
        body: {
          orderId: primaryJob.orderId,
          recipientType: primaryJob.type === 'pickup' ? 'sender' : 'receiver',
          deliveryTime,
          customMessage: message,
          relatedOrderIds: relatedOrderIds.length > 0 ? relatedOrderIds : undefined
        }
      });

      if (error) {
        console.error('Error sending grouped timeslots:', error);
        toast.error(`Failed to send consolidated timeslot: ${error.message}`);
        return;
      }

      // Handle individual operation results
      if (data?.results) {
        const { whatsapp, shipday, email } = data.results;
        if (whatsapp?.success) toast.success(`WhatsApp sent to ${jobsAtLocation.length} grouped jobs`);
        if (email?.success) toast.success("Email sent");
        if (shipday?.success) toast.success(`Shipday updated for ${jobsAtLocation.length} jobs`);
        if (!whatsapp?.success) toast.error(`WhatsApp failed: ${whatsapp?.error}`);
        if (!email?.success && email?.error) toast.warning(`Email failed: ${email.error}`);
        if (!shipday?.success && shipday?.error) toast.warning(`Shipday failed: ${shipday.error}`);
      } else {
        toast.success(`Consolidated timeslot sent for ${jobsAtLocation.length} jobs`);
      }
      const shipdayResults = data?.shipdayResults || [];
      const successfulUpdates = shipdayResults.filter((r: any) => r.status === 'success').length;
      const failedUpdates = shipdayResults.filter((r: any) => r.status === 'failed' || r.status === 'error').length;
      
      let toastMessage = `Consolidated timeslot sent for ${jobsAtLocation.length} jobs at this location`;
      if (successfulUpdates > 0) {
        toastMessage += ` (${successfulUpdates} Shipday orders updated)`;
      }
      if (failedUpdates > 0) {
        toastMessage += ` - ${failedUpdates} Shipday updates failed`;
      }
      
      toast.success(toastMessage);
    } catch (error) {
      console.error('Error sending grouped timeslots:', error);
      toast.error('Failed to send some timeslots');
    } finally {
      setIsSendingTimeslots(false);
    }
  };

  const sendAllTimeslots = async () => {
    const jobsToSend = selectedJobs.filter(job => 
      job.type !== 'break' && 
      job.estimatedTime && 
      job.lat && 
      job.lon
    );
    
    if (jobsToSend.length === 0) {
      toast.error('No jobs with valid timeslots and coordinates to send');
      return;
    }

    setIsSendingTimeslots(true);
    let successCount = 0;
    let failureCount = 0;

    try {
      // Step 1: Group jobs by actual coordinates (not relying on pre-set grouping info)
      const processedGroupIds = new Set<string>();
      const groupedLocationMap = new Map<string, SelectedJob[]>();
      const standaloneJobs: SelectedJob[] = [];

      // First, group jobs by coordinates
      const coordinateGroups: { [key: string]: SelectedJob[] } = {};
      
      for (const job of jobsToSend) {
        if (!job.lat || !job.lon) {
          standaloneJobs.push(job);
          continue;
        }
        
        // Find existing group with same location (within 750 meters)
        let foundGroupKey: string | null = null;
        for (const [groupKey, groupJobs] of Object.entries(coordinateGroups)) {
          const firstJobInGroup = groupJobs[0];
          if (firstJobInGroup.lat && firstJobInGroup.lon && 
              isSameLocation({ lat: job.lat, lon: job.lon }, { lat: firstJobInGroup.lat, lon: firstJobInGroup.lon })) {
            foundGroupKey = groupKey;
            break;
          }
        }
        
        if (foundGroupKey) {
          coordinateGroups[foundGroupKey].push(job);
        } else {
          // Create new group
          const newGroupKey = `coord-${job.lat}-${job.lon}`;
          coordinateGroups[newGroupKey] = [job];
        }
      }
      
      // Step 2: Separate into grouped (2+ jobs) vs standalone (1 job)
      for (const [groupKey, jobs] of Object.entries(coordinateGroups)) {
        if (jobs.length >= 2) {
          groupedLocationMap.set(groupKey, jobs);
        } else {
          standaloneJobs.push(jobs[0]);
        }
      }

      console.log(`Grouping results: ${groupedLocationMap.size} grouped locations, ${standaloneJobs.length} standalone jobs`);

      // Step 2: Process grouped locations FIRST (one message per location)
      for (const [locationGroupId, jobsAtLocation] of groupedLocationMap.entries()) {
        if (processedGroupIds.has(locationGroupId)) continue;
        processedGroupIds.add(locationGroupId);

        try {
          const primaryJob = jobsAtLocation[0];
          const deliveryTime = `${primaryJob.estimatedTime}:00`;
          
          // Create datetime from selected date and estimated time
          const [jobHours, jobMinutes] = primaryJob.estimatedTime.split(':').map(Number);
          const dateStr = format(selectedDate, 'yyyy-MM-dd');
          const [year, month, day] = dateStr.split('-').map(Number);
          const scheduledDateTime = new Date(year, month - 1, day, jobHours, jobMinutes, 0, 0);
          
          // Separate deliveries and collections
          const deliveries: string[] = [];
          const collections: string[] = [];
          
          jobsAtLocation.forEach(job => {
            const brand = job.orderData?.bike_brand || 'Unknown Brand';
            const model = job.orderData?.bike_model || 'Unknown Model';
            const bikeInfo = `${brand} ${model}`;
            
            if (job.type === 'delivery') {
              deliveries.push(bikeInfo);
            } else if (job.type === 'pickup') {
              collections.push(bikeInfo);
            }
          });
          
          // Format timeslot window
          const [windowHours, windowMinutes] = primaryJob.estimatedTime.split(':').map(Number);
          const endHour = Math.min(23, windowHours + 3);
          const startTime = `${windowHours.toString().padStart(2, '0')}:${windowMinutes.toString().padStart(2, '0')}`;
          const endTime = `${endHour.toString().padStart(2, '0')}:${windowMinutes.toString().padStart(2, '0')}`;
          const timeWindow = `${startTime} and ${endTime}`;
          const formattedDate = format(selectedDate, 'EEEE d MMMM yyyy');
          
          // Create consolidated message
          let message = `Dear ${primaryJob.contactName},\n\n`;
          message += `We are due to be with you on ${formattedDate} between ${timeWindow} for the following deliveries and collections.\n\n`;
          
          if (deliveries.length > 0) {
            message += `Deliveries: ${deliveries.join(', ')}\n`;
          }
          if (collections.length > 0) {
            message += `Collections: ${collections.join(', ')}\n`;
          }
          
          message += `\nYou will receive a text with a live tracking link once the driver is on his way.\n\n`;
          message += `Please ensure the pedals have been removed from the bikes we are collecting and are in a bag along with any other accessories. Make sure the bag is attached to the bike securely to avoid any loss.\n\n`;
          message += `Thank you!\nCycle Courier Co.`;
          
          // Update ALL jobs at this location
          for (const job of jobsAtLocation) {
            const updateField = job.type === 'pickup' ? 'pickup_timeslot' : 'delivery_timeslot';
            const dateField = job.type === 'pickup' ? 'scheduled_pickup_date' : 'scheduled_delivery_date';
            
            await supabase
              .from('orders')
              .update({ 
                [updateField]: deliveryTime,
                [dateField]: scheduledDateTime.toISOString()
              })
              .eq('id', job.orderId);
              
            // Update status
            let newStatus: any = 'scheduled';
            if (job.type === 'pickup') {
              newStatus = "collection_scheduled";
            } else if (job.type === 'delivery') {
              const order = job.orderData;
              const pickupDate = order?.scheduled_pickup_date;
              
              if (pickupDate && scheduledDateTime) {
                const pickupDateOnly = new Date(pickupDate).toDateString();
                const deliveryDateOnly = scheduledDateTime.toDateString();
                
                if (pickupDateOnly === deliveryDateOnly) {
                  newStatus = "scheduled";
                } else {
                  newStatus = "delivery_scheduled";
                }
              } else {
                newStatus = "delivery_scheduled";
              }
            }
            
            await supabase
              .from('orders')
              .update({ status: newStatus })
              .eq('id', job.orderId);
          }
          
          // Send ONE consolidated message
          const relatedOrderIds = jobsAtLocation
            .filter(job => job.orderId !== primaryJob.orderId)
            .map(job => job.orderId);
          
          const { data, error } = await supabase.functions.invoke('send-timeslot-whatsapp', {
            body: {
              orderId: primaryJob.orderId,
              recipientType: primaryJob.type === 'pickup' ? 'sender' : 'receiver',
              deliveryTime,
              customMessage: message,
              relatedOrderIds: relatedOrderIds.length > 0 ? relatedOrderIds : undefined
            }
          });

          if (error) {
            console.error(`Error sending grouped timeslots for location ${locationGroupId}:`, error);
            failureCount++;
          } else {
            successCount++;
          }

          // Add 30-second delay after each grouped location
          if (groupedLocationMap.size > 1 || standaloneJobs.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 30 * 1000));
          }

        } catch (groupError) {
          console.error(`Error processing grouped location ${locationGroupId}:`, groupError);
          failureCount++;
        }
      }

      // Step 3: Process standalone jobs (individual messages)
      for (let i = 0; i < standaloneJobs.length; i++) {
        const job = standaloneJobs[i];
        
        try {
          const deliveryTime = `${job.estimatedTime}:00`;
          
          // Create datetime from selected date and estimated time
          const [hours, minutes] = job.estimatedTime.split(':').map(Number);
          const dateStr = format(selectedDate, 'yyyy-MM-dd');
          const [year, month, day] = dateStr.split('-').map(Number);
          const scheduledDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
          
          // Save the timeslot and scheduled date
          const updateField = job.type === 'pickup' ? 'pickup_timeslot' : 'delivery_timeslot';
          const dateField = job.type === 'pickup' ? 'scheduled_pickup_date' : 'scheduled_delivery_date';
          
          const { error: updateError } = await supabase
            .from('orders')
            .update({ 
              [updateField]: job.estimatedTime,
              [dateField]: scheduledDateTime.toISOString()
            })
            .eq('id', job.orderId);

          if (updateError) {
            console.error(`Error saving timeslot for ${job.contactName}:`, updateError);
            failureCount++;
            continue;
          }

          // Send individual WhatsApp message
          const { data, error } = await supabase.functions.invoke('send-timeslot-whatsapp', {
            body: {
              orderId: job.orderId,
              recipientType: job.type === 'pickup' ? 'sender' : 'receiver',
              deliveryTime: job.estimatedTime
            }
          });

          if (error) {
            console.error(`Error sending timeslot to ${job.contactName}:`, error);
            failureCount++;
          } else if (data?.results) {
            if (data.results.whatsapp?.success || data.results.shipday?.success || data.results.email?.success) {
              successCount++;
            } else {
              failureCount++;
            }
          } else {
            successCount++;
          }

          // Add 30-second delay between standalone jobs
          if (i < standaloneJobs.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 30 * 1000));
          }

        } catch (jobError) {
          console.error(`Error processing standalone job for ${job.contactName}:`, jobError);
          failureCount++;
        }
      }

      // Show summary toast
      const totalProcessed = groupedLocationMap.size + standaloneJobs.length;
      if (successCount > 0 && failureCount === 0) {
        toast.success(`All ${successCount} timeslot message(s) sent successfully!`);
      } else if (successCount > 0 && failureCount > 0) {
        toast.success(`${successCount} sent successfully, ${failureCount} failed`);
      } else {
        toast.error(`Failed to send all ${failureCount} timeslots`);
      }

    } catch (error) {
      console.error('Error in bulk send:', error);
      toast.error('Failed to send timeslots');
    } finally {
      setIsSendingTimeslots(false);
    }
  };

  const createTimeslip = async () => {
    if (selectedJobs.length === 0) return;

    setIsSendingTimeslip(true);
    try {
      // Group jobs by location to get unique stops
      const groupedJobs = groupJobsByLocation(selectedJobs);
      const routeJobs = groupedJobs.filter(job => job.type !== 'break');
      
      // Get unique locations only (one per group)
      const uniqueLocations: { lat: number; lon: number; address: string }[] = [];
      const processedGroups = new Set<string>();
      
      routeJobs.forEach(job => {
        if (job.lat && job.lon) {
          const groupKey = job.locationGroupId || `single-${job.orderId}-${job.type}`;
          if (!processedGroups.has(groupKey)) {
            uniqueLocations.push({
              lat: job.lat,
              lon: job.lon,
              address: job.address
            });
            processedGroups.add(groupKey);
          }
        }
      });
      
      const totalUniqueStops = uniqueLocations.length;
      
      // Calculate actual driving time using Geoapify API
      let drivingMinutes = 0;
      const baseCoords = { lat: 52.4690197, lon: -1.8757663 }; // Lawden Road, B10 0AD
      
      if (uniqueLocations.length > 0) {
        try {
          // Calculate route: Lawden Road -> all unique stops -> back to Lawden Road
          let currentCoords = baseCoords;
          
          for (const location of uniqueLocations) {
            const travelTime = await calculateTravelTime(currentCoords, { lat: location.lat, lon: location.lon });
            drivingMinutes += travelTime;
            currentCoords = { lat: location.lat, lon: location.lon };
          }
          
          // Add return leg to Lawden Road
          const returnTime = await calculateTravelTime(currentCoords, baseCoords);
          drivingMinutes += returnTime;
          
        } catch (error) {
          console.error('Error calculating driving time:', error);
          // Fallback: use 15 minutes per stop + 30 minutes return
          drivingMinutes = (totalUniqueStops * 15) + 30;
        }
      }
      
      const drivingHours = Math.round((drivingMinutes / 60) * 100) / 100;
      
      // Calculate stop time based on unique stops (what's displayed)
      const stopMinutes = totalUniqueStops * 10; // 10 minutes per unique stop
      const stopHours = stopMinutes / 60;
      const lunchHours = 1;
      const totalHours = Math.round((drivingHours + stopHours + lunchHours) * 100) / 100;
      const totalPay = Math.round((totalHours * 11) * 100) / 100;

      // Create Google Maps route link using unique locations only
      const uniqueAddresses = uniqueLocations.map(loc => encodeURIComponent(loc.address));
      let routeLink = `https://www.google.com/maps/dir/Lawden+Road,+Birmingham,+B10+0AD/${uniqueAddresses.join('/')}/Lawden+Road,+Birmingham,+B10+0AD`;
      
      // If more than 10 unique stops, split into 2 routes
      if (uniqueAddresses.length > 10) {
        const firstHalf = uniqueAddresses.slice(0, 5);
        const secondHalf = uniqueAddresses.slice(5);
        routeLink = `Route 1: https://www.google.com/maps/dir/Lawden+Road,+Birmingham,+B10+0AD/${firstHalf.join('/')}/Lawden+Road,+Birmingham,+B10+0AD
Route 2: https://www.google.com/maps/dir/Lawden+Road,+Birmingham,+B10+0AD/${secondHalf.join('/')}/Lawden+Road,+Birmingham,+B10+0AD`;
      }

      // Format the selected date
      const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-GB', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };

      const message = `Timeslip - ${formatDate(selectedDate)}

Driving Total Hours: ${drivingHours}

Stops: ${totalUniqueStops} → ${stopMinutes}m → ${stopHours}h → round = ${stopHours}h

Lunch: 1h

Total Hours: ${drivingHours} + ${stopHours} + Lunch 

Total Pay: Total hours x £11 per hour = £${totalPay}

Route Link: ${routeLink}`;

      // Send WhatsApp message via edge function
      await supabase.functions.invoke('send-timeslip-whatsapp', {
        body: {
          phoneNumber: '+441217980767',
          message: message
        }
      });

      toast.success('Timeslip sent successfully');
      // Route and timeslots remain visible for further use
    } catch (error) {
      console.error('Error creating timeslip:', error);
      toast.error('Failed to create timeslip');
    } finally {
      setIsSendingTimeslip(false);
    }
  };

  const availableJobs = getJobsFromOrders();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Route Builder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {availableJobs.map((job, index) => {
              const isSelected = selectedJobs.some(j => j.orderId === job.orderId && j.type === job.type);
              const selectedOrder = selectedJobs.find(j => j.orderId === job.orderId && j.type === job.type)?.order;
              const hasCoordinates = job.lat && job.lon;
              
              return (
                <Card 
                  key={`${job.orderId}-${job.type}`}
                  className={`transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                  } ${!hasCoordinates ? 'border-orange-500 bg-orange-50' : 'cursor-pointer hover:bg-accent/50'}`}
                  onClick={hasCoordinates ? () => toggleJobSelection(job) : undefined}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant={job.type === 'pickup' ? 'default' : 'secondary'}>
                        {job.type === 'pickup' ? 'Collection' : 'Delivery'}
                      </Badge>
                      {isSelected && (
                        <Badge variant="outline" className="bg-primary text-primary-foreground">
                          #{selectedOrder}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <p className="font-medium text-sm">{job.contactName}</p>
                      <div className="flex items-start gap-1">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{job.address}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Order: {job.order.bike_brand} {job.order.bike_model}
                      </p>
                      {!hasCoordinates && (
                        <div className="space-y-2">
                          <Badge variant="outline" className="text-orange-600 border-orange-500">
                            Missing coordinates
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCoordinateDialog(job.orderId, job.type, job.contactName, job.address);
                            }}
                            className="w-full flex items-center gap-1 text-orange-600 hover:text-orange-700"
                          >
                            <Edit3 className="h-3 w-3" />
                            Update Coordinates
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {selectedJobs.length > 0 && (
            <div className="flex gap-4">
              <Button onClick={calculateTimeslots} className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Get Timeslots ({selectedJobs.length} jobs)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isMobile === undefined ? null : isMobile ? (
        <Drawer open={showTimeslotDialog} onOpenChange={setShowTimeslotDialog}>
          <DrawerContent className="max-h-[90vh] overflow-hidden">
            <DrawerHeader className="text-left pb-2">
              <DrawerTitle className="text-base">Route Timeslots</DrawerTitle>
            </DrawerHeader>
            
            <div className="overflow-y-auto overflow-x-hidden px-4 pb-4">
              <div className="space-y-3">
                {/* Controls */}
                <div className="space-y-3 p-2 bg-muted/50 rounded-lg">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Start Time:</label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full h-9 text-sm"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Date:</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-9 text-sm",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{selectedDate ? format(selectedDate, "PPP") : "Pick a date"}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => date && setSelectedDate(date)}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <Button onClick={calculateTimeslots} size="sm" className="w-full h-8 text-xs">
                    Recalculate
                  </Button>
                </div>

                {/* Route */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="text-xs font-medium truncate flex-1">Start: Lawden Rd, B10 0AD</span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0">{startTime}</Badge>
                    <Badge variant="outline" className="bg-green-100 text-green-800 text-xs px-1.5 py-0 whitespace-nowrap">
                      🚲 {startingBikes}
                    </Badge>
                  </div>

                  {selectedJobs.map((job, index) => (
                    <JobItem 
                      key={`${job.orderId}-${job.type}-${job.order}`}
                      job={job}
                      index={index}
                      onReorder={reorderJobs}
                      onAddBreak={addBreak}
                      onRemove={removeJob}
                      onSendTimeslot={openTimeslotEditDialog}
                      onSendGroupedTimeslots={sendGroupedTimeslots}
                      onUpdateCoordinates={updateCoordinates}
                      isSendingTimeslots={isSendingTimeslots}
                      allJobs={selectedJobs}
                      bikeCount={calculateBikeCountAtJob(index)}
                      startingBikes={startingBikes}
                      selectedDate={selectedDate}
                    />
                  ))}

                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="text-xs font-medium truncate flex-1">End: Lawden Rd, B10 0AD</span>
                    <Badge variant="outline" className="bg-green-100 text-green-800 text-xs px-1.5 py-0 whitespace-nowrap">
                      🚲 {calculateFinalBikeCount()}
                    </Badge>
                  </div>
                  
                  <Button
                    onClick={sendAllTimeslots}
                    disabled={isSendingTimeslots || selectedJobs.filter(job => job.type !== 'break' && job.estimatedTime && job.lat && job.lon).length === 0}
                    variant="outline"
                    size="sm"
                    className="w-full flex items-center justify-center gap-1 h-9 text-sm"
                  >
                    <Send className="h-3 w-3" />
                    {isSendingTimeslots ? 'Sending...' : 'Send All Timeslots'}
                  </Button>
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showTimeslotDialog} onOpenChange={setShowTimeslotDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Route Timeslots</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Start Time:</label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-32"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Date:</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-48 justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <Button onClick={calculateTimeslots} size="sm">
                  Recalculate
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm font-medium">Start: Lawden Road, Birmingham, B10 0AD</span>
                  <Badge variant="outline">{startTime}</Badge>
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    🚲 {startingBikes} bikes
                  </Badge>
                </div>

                {selectedJobs.map((job, index) => (
                  <JobItem 
                    key={`${job.orderId}-${job.type}-${job.order}`}
                    job={job}
                    index={index}
                    onReorder={reorderJobs}
                    onAddBreak={addBreak}
                    onRemove={removeJob}
                    onSendTimeslot={openTimeslotEditDialog}
                    onSendGroupedTimeslots={sendGroupedTimeslots}
                    onUpdateCoordinates={updateCoordinates}
                    isSendingTimeslots={isSendingTimeslots}
                    allJobs={selectedJobs}
                    bikeCount={calculateBikeCountAtJob(index)}
                    startingBikes={startingBikes}
                    selectedDate={selectedDate}
                  />
                ))}

                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm font-medium">End: Lawden Road, Birmingham, B10 0AD</span>
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    🚲 {calculateFinalBikeCount()} bikes
                  </Badge>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={sendAllTimeslots}
                    disabled={isSendingTimeslots || selectedJobs.filter(job => job.type !== 'break' && job.estimatedTime && job.lat && job.lon).length === 0}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Send className="h-3 w-3" />
                    {isSendingTimeslots ? 'Sending All...' : 'Send All Timeslots'}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Coordinate Update Dialog */}
      <Dialog open={showCoordinateDialog} onOpenChange={setShowCoordinateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Coordinates</DialogTitle>
          </DialogHeader>
          {coordinateJobToUpdate && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">{coordinateJobToUpdate.contactName}</p>
                <p className="text-xs text-muted-foreground">{coordinateJobToUpdate.address}</p>
                <Badge variant={coordinateJobToUpdate.type === 'pickup' ? 'default' : 'secondary'}>
                  {coordinateJobToUpdate.type === 'pickup' ? 'Collection' : 'Delivery'}
                </Badge>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Latitude</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="e.g., 53.123456"
                    value={coordinateInputs.lat}
                    onChange={(e) => setCoordinateInputs(prev => ({ ...prev, lat: e.target.value }))}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Range: -90 to 90</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Longitude</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="e.g., -2.123456"
                    value={coordinateInputs.lon}
                    onChange={(e) => setCoordinateInputs(prev => ({ ...prev, lon: e.target.value }))}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Range: -180 to 180</p>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowCoordinateDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCoordinateUpdate}
                  disabled={!coordinateInputs.lat || !coordinateInputs.lon}
                  className="flex-1"
                >
                  Update
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TimeslotEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        job={jobToEdit}
        onConfirm={(job, editedTime) => {
          setEditDialogOpen(false);
          sendTimeslot(job, editedTime);
        }}
        isLoading={isSendingTimeslots}
      />
    </div>
  );
};

export default RouteBuilder;