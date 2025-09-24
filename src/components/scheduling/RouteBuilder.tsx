import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Send, Route } from "lucide-react";
import { OrderData } from "@/pages/JobScheduling";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SelectedJob {
  orderId: string;
  type: 'pickup' | 'delivery';
  address: string;
  contactName: string;
  phoneNumber: string;
  order: number;
  estimatedTime?: string;
  actualTime?: string;
  lat?: number;
  lon?: number;
}

interface RouteBuilderProps {
  orders: OrderData[];
}

const RouteBuilder: React.FC<RouteBuilderProps> = ({ orders }) => {
  const [selectedJobs, setSelectedJobs] = useState<SelectedJob[]>([]);
  const [showTimeslotDialog, setShowTimeslotDialog] = useState(false);
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
    
    orders.forEach(order => {
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
        type: job.type,
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

  const calculateTimeslots = async () => {
    if (selectedJobs.length === 0) return;

    // Check for missing coordinates
    const jobsWithoutCoords = selectedJobs.filter(job => !job.lat || !job.lon);
    if (jobsWithoutCoords.length > 0) {
      const addressList = jobsWithoutCoords.map(job => `${job.contactName} (${job.address})`).join('\n');
      toast.error(`Missing coordinates for addresses:\n${addressList}\n\nPlease ensure all addresses have latitude/longitude coordinates.`);
      return;
    }

    const baseCoords = { lat: 52.4690197, lon: -1.8757663 }; // Birmingham coordinates for Lawden Road, B10 0AD
    
    try {
      const updatedJobs = [];
      let currentTime = new Date(`2024-01-01 ${startTime}`);
      
      for (let i = 0; i < selectedJobs.length; i++) {
        const job = selectedJobs[i];
        
        if (i === 0) {
          // First job - calculate travel time from base to first location
          const travelTime = await calculateTravelTime(baseCoords, { lat: job.lat!, lon: job.lon! });
          currentTime = new Date(currentTime.getTime() + travelTime * 60000);
        } else {
          // Calculate travel time from previous job to current job
          const previousJob = selectedJobs[i - 1];
          const travelTime = await calculateTravelTime(
            { lat: previousJob.lat!, lon: previousJob.lon! }, 
            { lat: job.lat!, lon: job.lon! }
          );
          // Add travel time + 15 minutes service time from previous job
          currentTime = new Date(currentTime.getTime() + (travelTime + 15) * 60000);
        }
        
        updatedJobs.push({
          ...job,
          estimatedTime: currentTime.toTimeString().slice(0, 5)
        });
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
      const url = `https://api.geoapify.com/v1/routing?waypoints=${waypoints}&mode=light_truck&type=balanced&traffic=approximated&format=json&apiKey=${apiKey}`;
      
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
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                  } ${!hasCoordinates ? 'border-orange-500 bg-orange-50' : ''}`}
                  onClick={() => toggleJobSelection(job)}
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
                        <Badge variant="outline" className="text-orange-600 border-orange-500">
                          Missing coordinates
                        </Badge>
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
                <div key={`${job.orderId}-${job.type}`} className="flex items-center justify-between p-3 bg-background border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">#{job.order}</Badge>
                    <div>
                      <p className="text-sm font-medium">{job.contactName}</p>
                      <p className="text-xs text-muted-foreground">{job.address}</p>
                      <Badge variant={job.type === 'pickup' ? 'default' : 'secondary'} className="text-xs">
                        {job.type === 'pickup' ? 'Collection' : 'Delivery'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {job.estimatedTime && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {job.estimatedTime}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      onClick={() => sendTimeslot(job)}
                      disabled={isSendingTimeslots || !job.estimatedTime}
                      className="flex items-center gap-1"
                    >
                      <Send className="h-3 w-3" />
                      Send
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <MapPin className="h-4 w-4" />
                <span className="text-sm font-medium">End: Lawden Road, Birmingham, B10 0AD</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RouteBuilder;