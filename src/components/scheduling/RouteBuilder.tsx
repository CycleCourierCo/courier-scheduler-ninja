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
  estimatedTime?: string;
  actualTime?: string;
  lat?: number;
  lon?: number;
  breakDuration?: number; // Duration in minutes for breaks
  breakType?: 'lunch' | 'stop';
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
  onUpdateCoordinates: (job: SelectedJob, lat: number, lon: number) => void;
  isSendingTimeslots: boolean;
}

const JobItem: React.FC<JobItemProps> = ({ 
  job, 
  index, 
  onReorder, 
  onAddBreak, 
  onRemove, 
  onSendTimeslot, 
  onUpdateCoordinates,
  isSendingTimeslots 
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
          <div>
            <p className="text-sm font-medium">{job.contactName}</p>
            <p className="text-xs text-muted-foreground">{job.address}</p>
            {job.type === 'break' ? (
              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800">
                {job.breakType === 'lunch' ? '🍽️ Lunch Break' : '☕ Stop Break'} ({job.breakDuration}min)
              </Badge>
            ) : (
              <Badge variant={job.type === 'pickup' ? 'default' : 'secondary'} className="text-xs">
                {job.type === 'pickup' ? 'Collection' : 'Delivery'}
              </Badge>
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
  const [isSendingTimeslots, setIsSendingTimeslots] = useState(false);
  const [isSendingTimeslip, setIsSendingTimeslip] = useState(false);

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

  const updateAvailableJobCoordinates = (orderId: string, type: 'pickup' | 'delivery', lat: number, lon: number) => {
    try {
      // Validate coordinates
      coordinateSchema.parse({ lat, lon });
      
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
        toast.error('Invalid coordinates');
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
        phoneNumber: job.phoneNumber,
        order: selectedJobs.length + 1,
        lat: job.lat,
        lon: job.lon
      };
      setSelectedJobs(prev => [...prev, newJob]);
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
  };

  const removeJob = (jobToRemove: SelectedJob) => {
    const updatedJobs = selectedJobs
      .filter(job => !(job.orderId === jobToRemove.orderId && job.type === jobToRemove.type))
      .map((job, index) => ({
        ...job,
        order: index + 1
      }));
    setSelectedJobs(updatedJobs);
  };

  const updateCoordinates = (jobToUpdate: SelectedJob, lat: number, lon: number) => {
    const updatedJobs = selectedJobs.map(job => 
      (job.orderId === jobToUpdate.orderId && job.type === jobToUpdate.type) 
        ? { ...job, lat, lon }
        : job
    );
    setSelectedJobs(updatedJobs);
    toast.success('Coordinates updated successfully');
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

  const calculateTimeslots = async () => {
    if (selectedJobs.length === 0) return;

    // Filter out breaks for coordinate validation and routing
    const routeJobs = selectedJobs.filter(job => job.type !== 'break');

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
      
      for (let i = 0; i < selectedJobs.length; i++) {
        const job = selectedJobs[i];
        
        if (job.type === 'break') {
          // For breaks, just add the break duration
          currentTime = new Date(currentTime.getTime() + (job.breakDuration || 15) * 60000);
          const roundedBreakTime = roundTimeToNext5Minutes(currentTime);
          updatedJobs.push({
            ...job,
            estimatedTime: roundedBreakTime.toTimeString().slice(0, 5)
          });
          currentTime = roundedBreakTime; // Update current time to rounded time
        } else {
          // For regular jobs, calculate travel time
          const travelTime = await calculateTravelTime(lastLocationCoords, { lat: job.lat!, lon: job.lon! });
          currentTime = new Date(currentTime.getTime() + travelTime * 60000);
          
          // Add 15 minutes service time for each job
          currentTime = new Date(currentTime.getTime() + 15 * 60000);
          
          // Round to next 5-minute increment
          const roundedJobTime = roundTimeToNext5Minutes(currentTime);
          
          updatedJobs.push({
            ...job,
            estimatedTime: roundedJobTime.toTimeString().slice(0, 5)
          });
          
          // Update last location for next calculation and use rounded time
          lastLocationCoords = { lat: job.lat!, lon: job.lon! };
          currentTime = roundedJobTime;
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
      
      await supabase.functions.invoke('send-timeslot-whatsapp', {
        body: {
          orderId: job.orderId,
          recipientType: job.type === 'pickup' ? 'sender' : 'receiver',
          deliveryTime
        }
      });

      toast.success(`Timeslot sent to ${job.contactName}`);
    } catch (error) {
      console.error('Error sending timeslot:', error);
      toast.error('Failed to send timeslot');
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
                  onUpdateCoordinates={updateCoordinates}
                  isSendingTimeslots={isSendingTimeslots}
                />
              ))}

              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <MapPin className="h-4 w-4" />
                <span className="text-sm font-medium">End: Lawden Road, Birmingham, B10 0AD</span>
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