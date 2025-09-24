import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Send, Route, GripVertical, Plus, Coffee, Edit3 } from "lucide-react";
import { OrderData } from "@/pages/JobScheduling";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDraggable } from "@/hooks/useDraggable";
import { useDroppable } from "@/hooks/useDroppable";
import { z } from "zod";

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
}

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
  startingBikes
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
        className={`flex items-center justify-between p-3 bg-background border rounded-lg transition-opacity ${
          isDragging ? 'opacity-50' : ''
        } hover:shadow-md cursor-move`}
      >
        <div className="flex items-center gap-3">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <Badge variant="outline">#{job.order}</Badge>
          <div className="flex-1">
            {groupedJobs.length > 1 ? (
              // Multiple jobs at same location
              <div className="space-y-2">
                <p className="text-sm font-medium">📍 Multiple stops at this location</p>
                <p className="text-xs text-muted-foreground">{job.address}</p>
                <div className="space-y-1">
                  {groupedJobs.map((groupedJob, idx) => (
                    <div key={`${groupedJob.orderId}-${groupedJob.type}`} className="flex items-center gap-2 pl-2 border-l-2 border-muted">
                      <Badge variant={groupedJob.type === 'pickup' ? 'default' : 'secondary'} className="text-xs">
                        {groupedJob.type === 'pickup' ? 'Collection' : 'Delivery'}
                      </Badge>
                      <span className="text-xs font-medium">{groupedJob.contactName}</span>
                      <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                        🚲 {bikeCount} bikes
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Single job
              <div>
                <p className="text-sm font-medium">{job.contactName}</p>
                <p className="text-xs text-muted-foreground">{job.address}</p>
                <div className="flex gap-1 flex-wrap">
                  {job.type === 'break' ? (
                    <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800">
                      {job.breakType === 'lunch' ? '🍽️ Lunch Break' : '☕ Stop Break'} ({job.breakDuration}min)
                    </Badge>
                  ) : (
                    <Badge variant={job.type === 'pickup' ? 'default' : 'secondary'} className="text-xs">
                      {job.type === 'pickup' ? 'Collection' : 'Delivery'}
                    </Badge>
                  )}
                  {job.type !== 'break' && (
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                      🚲 {bikeCount} bikes
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {job.estimatedTime && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {job.estimatedTime}
            </Badge>
          )}
          
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
              className="flex items-center gap-1 text-orange-600 hover:text-orange-700"
            >
              <Edit3 className="h-3 w-3" />
              Update Coords
            </Button>
          )}
          
          {job.type !== 'break' && (job.lat && job.lon) && (
            <div className="flex gap-1 flex-wrap">
              {groupedJobs.length > 1 ? (
                // Individual send buttons for each job in the group
                groupedJobs.map((groupedJob) => (
                  <Button
                    key={`${groupedJob.orderId}-${groupedJob.type}`}
                    size="sm"
                    onClick={() => onSendTimeslot(groupedJob)}
                    disabled={isSendingTimeslots || !groupedJob.estimatedTime}
                    className="flex items-center gap-1 text-xs"
                  >
                    <Send className="h-3 w-3" />
                    {groupedJob.type === 'pickup' ? 'Send Collection' : 'Send Delivery'}
                  </Button>
                ))
              ) : (
                // Single job send button
                <Button
                  size="sm"
                  onClick={() => onSendTimeslot(job)}
                  disabled={isSendingTimeslots || !job.estimatedTime}
                  className="flex items-center gap-1"
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
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                >
                  <Send className="h-3 w-3" />
                  Send All
                </Button>
              )}
            </div>
          )}
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRemove(job)}
            className="text-red-600 hover:text-red-700"
          >
            ×
          </Button>
        </div>
      </div>
      
      {/* Add break buttons after each job */}
      <div className="flex gap-1 ml-8">
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
    </div>
  );
};

const RouteBuilder: React.FC<RouteBuilderProps> = ({ orders }) => {
  const [selectedJobs, setSelectedJobs] = useState<SelectedJob[]>([]);
  const [orderList, setOrderList] = useState<OrderData[]>(orders);
  const [showTimeslotDialog, setShowTimeslotDialog] = useState(false);
  const [showCoordinateDialog, setShowCoordinateDialog] = useState(false);
  const [coordinateJobToUpdate, setCoordinateJobToUpdate] = useState<{orderId: string, type: 'pickup' | 'delivery', contactName: string, address: string} | null>(null);
  const [coordinateInputs, setCoordinateInputs] = useState({ lat: '', lon: '' });
  const [startTime, setStartTime] = useState("09:00");
  const [startingBikes, setStartingBikes] = useState<number>(0);
  const [isSendingTimeslots, setIsSendingTimeslots] = useState(false);
  const [isSendingTimeslip, setIsSendingTimeslip] = useState(false);

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

    return distance <= 50; // Within 50 meters
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

  const sendTimeslot = async (job: SelectedJob) => {
    if (!job.estimatedTime) return;

    setIsSendingTimeslots(true);
    try {
      const deliveryTime = `${job.estimatedTime}:00`;
      
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
      
      await supabase.functions.invoke('send-timeslot-whatsapp', {
        body: {
          orderId: job.orderId,
          recipientType: job.type === 'pickup' ? 'sender' : 'receiver',
          deliveryTime,
          customMessage: message
        }
      });

      toast.success(`Timeslot sent to ${job.contactName}${job.isGroupedLocation ? ' (grouped location)' : ''}`);
    } catch (error) {
      console.error('Error sending timeslot:', error);
      toast.error('Failed to send timeslot');
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
      const promises = jobsAtLocation.map(async (job) => {
        if (!job.estimatedTime) return;
        
        const deliveryTime = `${job.estimatedTime}:00`;
        const message = `Multiple ${job.type === 'pickup' ? 'collections' : 'deliveries'} at this location (${jobsAtLocation.length} total stops)`;
        
        return supabase.functions.invoke('send-timeslot-whatsapp', {
          body: {
            orderId: job.orderId,
            recipientType: job.type === 'pickup' ? 'sender' : 'receiver',
            deliveryTime,
            customMessage: message
          }
        });
      });

      await Promise.all(promises);
      toast.success(`Timeslots sent to all customers at this location (${jobsAtLocation.length} messages)`);
    } catch (error) {
      console.error('Error sending grouped timeslots:', error);
      toast.error('Failed to send some timeslots');
    } finally {
      setIsSendingTimeslots(false);
    }
  };

  const createTimeslip = async () => {
    if (selectedJobs.length === 0) return;

    setIsSendingTimeslip(true);
    try {
      const totalStops = selectedJobs.length;
      const drivingHours = Math.round((totalStops * 0.25 + 1) * 100) / 100; // Estimate driving time
      const stopMinutes = totalStops * 10; // 10 minutes per stop
      const stopHours = Math.round((stopMinutes / 60) * 100) / 100;
      const lunchHours = 1;
      const totalHours = Math.round((drivingHours + stopHours + lunchHours) * 100) / 100;
      const totalPay = Math.round((totalHours * 11) * 100) / 100;

      // Create Google Maps route link
      const addresses = selectedJobs.map(job => encodeURIComponent(job.address));
      let routeLink = `https://www.google.com/maps/dir/Lawden+Road,+Birmingham,+B10+0AD/${addresses.join('/')}/Lawden+Road,+Birmingham,+B10+0AD`;
      
      // If more than 10 stops, split into 2 routes
      if (addresses.length > 10) {
        const firstHalf = addresses.slice(0, 5);
        const secondHalf = addresses.slice(5);
        routeLink = `Route 1: https://www.google.com/maps/dir/Lawden+Road,+Birmingham,+B10+0AD/${firstHalf.join('/')}/Lawden+Road,+Birmingham,+B10+0AD
Route 2: https://www.google.com/maps/dir/Lawden+Road,+Birmingham,+B10+0AD/${secondHalf.join('/')}/Lawden+Road,+Birmingham,+B10+0AD`;
      }

      const message = `Driving Total Hours: ${drivingHours}

Stops: ${totalStops} → ${stopMinutes}m → ${stopHours}h → round = ${stopHours}h

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
      setSelectedJobs([]); // Clear selection after sending
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
              
              <Button 
                onClick={createTimeslip} 
                variant="outline"
                disabled={isSendingTimeslip}
                className="flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                {isSendingTimeslip ? 'Sending...' : 'Create Timeslip'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showTimeslotDialog} onOpenChange={setShowTimeslotDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Route Timeslots</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Start Time:</label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-32"
              />
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
                  onSendTimeslot={sendTimeslot}
                  onSendGroupedTimeslots={sendGroupedTimeslots}
                  onUpdateCoordinates={updateCoordinates}
                  isSendingTimeslots={isSendingTimeslots}
                  allJobs={selectedJobs}
                  bikeCount={calculateBikeCountAtJob(index)}
                  startingBikes={startingBikes}
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
                  onClick={() => addBreak(selectedJobs.length - 1, 'lunch')} 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Coffee className="h-3 w-3" />
                  Add Lunch Break
                </Button>
                <Button 
                  onClick={() => addBreak(selectedJobs.length - 1, 'stop')} 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Stop Break
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
    </div>
  );
};

export default RouteBuilder;