import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import { format } from "date-fns";
import DashboardHeader from "@/components/DashboardHeader";
import { supabase } from "@/integrations/supabase/client";
import { ContactInfo, Address, OrderStatus } from "@/types/order";
import { Separator } from "@/components/ui/separator";
import { ArrowDown, Calendar, MapPin, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import JobMap from "@/components/scheduling/JobMap";
import JobSchedulingForm from "@/components/scheduling/JobSchedulingForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isPointInPolygon } from "@/components/scheduling/JobMap";
import { segmentGeoJSON } from "@/components/scheduling/JobMap";
import PostcodePolygonSearch from "@/components/scheduling/PostcodePolygonSearch";
import RouteBuilder from "@/components/scheduling/RouteBuilder";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MultiJobTimeslotDialog from "@/components/scheduling/MultiJobTimeslotDialog";

export interface OrderData {
  id: string;
  status: OrderStatus;
  tracking_number: string;
  bike_brand: string | null;
  bike_model: string | null;
  bike_quantity: number | null;
  created_at: string;
  sender: ContactInfo & { address: Address };
  receiver: ContactInfo & { address: Address };
  scheduled_pickup_date: string | null;
  scheduled_delivery_date: string | null;
  pickup_date: string[] | null;
  delivery_date: string[] | null;
  collection_confirmation_sent_at: string | null;
  senderPolygonSegment?: number;
  receiverPolygonSegment?: number;
}

const getPolygonBadgeVariant = (segment: number | undefined) => {
  if (!segment) return undefined;
  
  const safeSegment = Math.min(Math.max(1, segment), 8);
  
  return `p${safeSegment}-segment` as 
    "p1-segment" | "p2-segment" | "p3-segment" | "p4-segment" | 
    "p5-segment" | "p6-segment" | "p7-segment" | "p8-segment";
};

const JobScheduling = () => {
  const [selectedTimeslipDate, setSelectedTimeslipDate] = useState<Date>();
  const [isTimeslipDialogOpen, setIsTimeslipDialogOpen] = useState(false);
  const [isGeneratingTimeslip, setIsGeneratingTimeslip] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(false);
  const [showDriverSelection, setShowDriverSelection] = useState(false);
  
  // New state for driver scheduling
  const [isDriverSchedulingOpen, setIsDriverSchedulingOpen] = useState(false);
  const [driverSchedulingDate, setDriverSchedulingDate] = useState<Date>();
  const [availableDriversForScheduling, setAvailableDriversForScheduling] = useState<any[]>([]);
  const [selectedDriverForScheduling, setSelectedDriverForScheduling] = useState<string>("");
  const [isLoadingDriverOrders, setIsLoadingDriverOrders] = useState(false);
  const [driverJobs, setDriverJobs] = useState<any[]>([]);
  const [isMultiJobDialogOpen, setIsMultiJobDialogOpen] = useState(false);
  const [showSchedulingDriverSelection, setShowSchedulingDriverSelection] = useState(false);

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['scheduling-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .not('status', 'in', '(cancelled,delivered)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const mappedOrders = data.map(order => ({
        ...order,
        sender: order.sender as ContactInfo & { address: Address },
        receiver: order.receiver as ContactInfo & { address: Address },
        status: order.status as OrderStatus
      })) as OrderData[];

      mappedOrders.forEach(order => {
        if (order.sender.address.lat && order.sender.address.lon) {
          order.senderPolygonSegment = getPolygonSegment(
            order.sender.address.lat,
            order.sender.address.lon
          );
        }
        
        if (order.receiver.address.lat && order.receiver.address.lon) {
          order.receiverPolygonSegment = getPolygonSegment(
            order.receiver.address.lat,
            order.receiver.address.lon
          );
        }
      });
      
      console.log("Mapped orders with segments:", mappedOrders.map(o => ({
        id: o.id, 
        senderPolygonSegment: o.senderPolygonSegment,
        receiverPolygonSegment: o.receiverPolygonSegment
      })));
      
      return mappedOrders;
    }
  });

  const getPolygonSegment = (lat: number, lng: number): number | null => {
    for (let i = 0; i < segmentGeoJSON.features.length; i++) {
      const polygon = segmentGeoJSON.features[i].geometry.coordinates[0];
      if (isPointInPolygon([lng, lat], polygon)) {
        return i + 1;
      }
    }
    return null;
  };

  const checkAndSetScheduledStatus = async (order: OrderData) => {
    if (order.status === "scheduled") return;

    if (order.scheduled_pickup_date && order.scheduled_delivery_date) {
      const { error } = await supabase
        .from("orders")
        .update({ status: "scheduled" })
        .eq("id", order.id);
      if (!error) {
        toast.success("Order marked as scheduled!");
        refetch();
      } else {
        toast.error("Error updating status to scheduled");
      }
    }
  };

  const handleScheduled = async (orderId?: string) => {
    toast.success("Job scheduled successfully");
    await refetch();
    if (!orders) return;

    if (orderId) {
      const foundOrder = orders.find(o => o.id === orderId);
      if (foundOrder) checkAndSetScheduledStatus(foundOrder);
    }
  };

  useEffect(() => {
    if (orders) {
      console.log("Orders loaded with polygon segments:", 
        orders.map(o => ({ 
          id: o.id, 
          senderPolygonSegment: o.senderPolygonSegment,
          receiverPolygonSegment: o.receiverPolygonSegment
        })));
    }
  }, [orders]);

  const formatAddress = (address: Address) => {
    return `${address.street}, ${address.city}, ${address.state} ${address.zipCode}, ${address.country}`;
  };

  const formatDates = (dates: string[] | null) => {
    if (!dates || dates.length === 0) return "No dates available";
    return dates.map(date => format(new Date(date), 'MMM d, yyyy')).join(", ");
  };

  const queryDriversForDate = async (selectedDate: Date) => {
    setIsLoadingDrivers(true);
    try {
      const targetDate = format(selectedDate, 'yyyy-MM-dd');
      console.log('Querying drivers for date:', targetDate);

      const { data, error } = await supabase.functions.invoke('query-shipday-completed-orders', {
        body: { date: targetDate }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to query Shipday orders');
      }

      console.log('Available drivers:', data.drivers);
      setAvailableDrivers(data.drivers);
      setShowDriverSelection(true);

      if (data.drivers.length === 0) {
        toast.error("No drivers found with completed orders for the selected date");
      }

    } catch (error: any) {
      console.error('Error querying drivers:', error);
      toast.error(`Failed to get drivers: ${error.message}`);
    } finally {
      setIsLoadingDrivers(false);
    }
  };

  const generateTimeslipForDriver = async (driverName: string) => {
    setIsGeneratingTimeslip(true);
    try {
      const selectedDriverData = availableDrivers.find(d => d.driverName === driverName);
      if (!selectedDriverData) {
        throw new Error('Driver data not found');
      }

      const orders = selectedDriverData.orders;
      console.log(`Generating timeslip for ${driverName} with ${orders.length} orders`);

      // Collect all addresses with lat/lng coordinates and delivery times
      const stops: Array<{lat: number, lng: number, address: string, deliveryTime: string, type: 'pickup' | 'delivery'}> = [];
      
      orders.forEach((order: any) => {
        // Only process orders for this specific driver
        if (order.carrier?.name !== driverName) {
          return;
        }

        // Add pickup location
        if (order.pickup?.lat && order.pickup?.lng) {
          stops.push({
            lat: order.pickup.lat,
            lng: order.pickup.lng,
            address: order.pickup.formattedAddress || order.pickup.address,
            deliveryTime: order.deliveryTime,
            type: 'pickup'
          });
        }
        
        // Add delivery location
        if (order.delivery?.lat && order.delivery?.lng) {
          stops.push({
            lat: order.delivery.lat,
            lng: order.delivery.lng,
            address: order.delivery.formattedAddress || order.delivery.address,
            deliveryTime: order.deliveryTime,
            type: 'delivery'
          });
        }
      });

      // Sort stops by delivery time (chronological order)
      stops.sort((a, b) => new Date(a.deliveryTime).getTime() - new Date(b.deliveryTime).getTime());

      // Remove duplicate locations (same lat/lng) while preserving chronological order
      const uniqueStops = stops.filter((stop, index, self) => 
        index === self.findIndex(s => s.lat === stop.lat && s.lng === stop.lng)
      );

      console.log(`Found ${uniqueStops.length} unique stops for driver ${driverName} (sorted by delivery time)`);

      // Calculate hours
      const drivingHours = 6; // Placeholder as requested
      const stopHours = Math.round((uniqueStops.length * 10 / 60) * 100) / 100; // 10 mins per stop, rounded to 2 decimal places
      const lunchHours = 1; // Placeholder
      const totalHours = drivingHours + stopHours + lunchHours;
      const totalPay = totalHours * 11;

      // Generate Google Maps routes using lat/lng coordinates
      let routeLinks = "";
      const baseCoords = "52.4707965,-1.8749747"; // Updated Lawden Road coordinates
      
      if (uniqueStops.length > 10) {
        const firstHalf = uniqueStops.slice(0, 10).map(stop => `${stop.lat},${stop.lng}`);
        const secondHalf = uniqueStops.slice(10).map(stop => `${stop.lat},${stop.lng}`);
        
        routeLinks = `Route 1: https://www.google.com/maps/dir/?api=1&origin=${baseCoords}&destination=${baseCoords}&waypoints=${firstHalf.join('|')}&travelmode=driving

Route 2: https://www.google.com/maps/dir/?api=1&origin=${baseCoords}&destination=${baseCoords}&waypoints=${secondHalf.join('|')}&travelmode=driving`;
      } else if (uniqueStops.length > 0) {
        const waypoints = uniqueStops.map(stop => `${stop.lat},${stop.lng}`).join('|');
        routeLinks = `Route: https://www.google.com/maps/dir/?api=1&origin=${baseCoords}&destination=${baseCoords}&waypoints=${waypoints}&travelmode=driving`;
      }

      // Format the timeslip message
      const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-GB', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };

      const message = `Timeslip - ${driverName} - ${formatDate(selectedTimeslipDate!)}

Driving Total Hours: ${drivingHours}

Stops: ${uniqueStops.length} -> ${stopHours}h

Lunch: ${lunchHours}h

Total Hours: ${totalHours}h

Total Pay: £${totalPay}

${routeLinks}`;

      // Send the timeslip via WhatsApp
      const { data: whatsappData, error: whatsappError } = await supabase.functions.invoke('send-timeslip-whatsapp', {
        body: { message }
      });

      if (whatsappError) throw whatsappError;

      toast.success("Timeslip sent successfully!");
      setIsTimeslipDialogOpen(false);
      setSelectedTimeslipDate(undefined);
      setSelectedDriver("");
      setShowDriverSelection(false);
      setAvailableDrivers([]);

    } catch (error: any) {
      console.error('Error generating timeslip:', error);
      toast.error(`Failed to generate timeslip: ${error.message}`);
    } finally {
      setIsGeneratingTimeslip(false);
    }
  };

  const fetchOrdersForDriverScheduling = async (selectedDate: Date | undefined) => {
    if (!selectedDate) return;
    
    setIsLoadingDriverOrders(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .not('status', 'in', '(cancelled,delivered)')
        .or(`collection_driver_name.not.is.null,delivery_driver_name.not.is.null`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group orders by driver name
      const driverMap = new Map<string, { 
        driverName: string; 
        collectionJobs: any[]; 
        deliveryJobs: any[];
        totalJobs: number;
      }>();

      data.forEach(order => {
        const sender = order.sender as any;
        const receiver = order.receiver as any;
        
        // Validate coordinates
        if (order.collection_driver_name) {
          const hasCoords = sender?.address?.lat && sender?.address?.lon;
          if (!hasCoords) {
            console.warn(`Missing coordinates for collection: Order ${order.tracking_number}`);
          }
        }
        
        if (order.delivery_driver_name) {
          const hasCoords = receiver?.address?.lat && receiver?.address?.lon;
          if (!hasCoords) {
            console.warn(`Missing coordinates for delivery: Order ${order.tracking_number}`);
          }
        }

        // Process collection jobs
        if (order.collection_driver_name) {
          if (!driverMap.has(order.collection_driver_name)) {
            driverMap.set(order.collection_driver_name, {
              driverName: order.collection_driver_name,
              collectionJobs: [],
              deliveryJobs: [],
              totalJobs: 0
            });
          }
          const driverData = driverMap.get(order.collection_driver_name)!;
          driverData.collectionJobs.push({
            ...order,
            jobType: 'collection',
            contact: sender,
            scheduledDate: order.scheduled_pickup_date,
            timeslot: order.pickup_timeslot,
            lat: sender?.address?.lat,
            lon: sender?.address?.lon
          });
          driverData.totalJobs++;
        }

        // Process delivery jobs
        if (order.delivery_driver_name) {
          if (!driverMap.has(order.delivery_driver_name)) {
            driverMap.set(order.delivery_driver_name, {
              driverName: order.delivery_driver_name,
              collectionJobs: [],
              deliveryJobs: [],
              totalJobs: 0
            });
          }
          const driverData = driverMap.get(order.delivery_driver_name)!;
          driverData.deliveryJobs.push({
            ...order,
            jobType: 'delivery',
            contact: receiver,
            scheduledDate: order.scheduled_delivery_date,
            timeslot: order.delivery_timeslot,
            lat: receiver?.address?.lat,
            lon: receiver?.address?.lon
          });
          driverData.totalJobs++;
        }
      });

      const driversArray = Array.from(driverMap.values());
      setAvailableDriversForScheduling(driversArray);
      setShowSchedulingDriverSelection(true);

      if (driversArray.length === 0) {
        toast.error("No drivers found with assigned orders");
      }

    } catch (error: any) {
      console.error('Error fetching driver orders:', error);
      toast.error(`Failed to get driver orders: ${error.message}`);
    } finally {
      setIsLoadingDriverOrders(false);
    }
  };

  const prepareDriverJobsForScheduling = (driverName: string) => {
    const driverData = availableDriversForScheduling.find(d => d.driverName === driverName);
    if (!driverData) return;

    // Combine collection and delivery jobs
    const allJobs = [
      ...driverData.collectionJobs,
      ...driverData.deliveryJobs
    ].map(job => ({
      orderId: job.id,
      type: job.jobType,
      contactName: job.contact.name,
      address: job.jobType === 'collection' 
        ? `${job.contact.address.street}, ${job.contact.address.city}` 
        : `${job.contact.address.street}, ${job.contact.address.city}`,
      phoneNumber: job.contact.phone,
      estimatedTime: job.timeslot || '',
      order: job,
      lat: job.lat,
      lon: job.lon,
      pickupDates: job.pickup_date,
      deliveryDates: job.delivery_date,
      collectionConfirmedAt: job.collection_confirmation_sent_at
    })).filter(job => job.lat && job.lon); // Only include jobs with valid coordinates

    const totalJobsCount = driverData.collectionJobs.length + driverData.deliveryJobs.length;
    const filteredCount = allJobs.length;

    if (allJobs.length === 0) {
      toast.error("No jobs found with valid coordinates");
      return;
    }

    if (filteredCount < totalJobsCount) {
      toast.warning(`${totalJobsCount - filteredCount} job(s) excluded due to missing coordinates`);
    }

    setDriverJobs(allJobs);
    setIsDriverSchedulingOpen(false);
    setIsMultiJobDialogOpen(true);
  };

  return (
    <Layout>
      <div className="container py-6">
        <DashboardHeader>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Job Scheduling</h1>
            <p className="text-muted-foreground">
              Manage and schedule deliveries
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isDriverSchedulingOpen} onOpenChange={setIsDriverSchedulingOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Schedule Job Based on Driver
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Schedule Jobs by Driver</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {!showSchedulingDriverSelection ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Select Date</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !driverSchedulingDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {driverSchedulingDate ? format(driverSchedulingDate, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={driverSchedulingDate}
                              onSelect={setDriverSchedulingDate}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setIsDriverSchedulingOpen(false);
                            setDriverSchedulingDate(undefined);
                            setShowSchedulingDriverSelection(false);
                            setAvailableDriversForScheduling([]);
                          }}
                          variant="outline"
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => fetchOrdersForDriverScheduling(driverSchedulingDate)}
                          disabled={!driverSchedulingDate || isLoadingDriverOrders}
                          className="flex-1"
                        >
                          {isLoadingDriverOrders ? "Loading..." : "Next"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Select Driver for {driverSchedulingDate && format(driverSchedulingDate, "PPP")}
                        </label>
                        <Select value={selectedDriverForScheduling} onValueChange={setSelectedDriverForScheduling}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose a driver" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableDriversForScheduling.map((driver) => (
                              <SelectItem key={driver.driverName} value={driver.driverName}>
                                {driver.driverName} ({driver.totalJobs} jobs: {driver.collectionJobs.length} collections, {driver.deliveryJobs.length} deliveries)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setShowSchedulingDriverSelection(false);
                            setSelectedDriverForScheduling("");
                            setAvailableDriversForScheduling([]);
                          }}
                          variant="outline"
                          className="flex-1"
                        >
                          Back
                        </Button>
                        <Button
                          onClick={() => selectedDriverForScheduling && prepareDriverJobsForScheduling(selectedDriverForScheduling)}
                          disabled={!selectedDriverForScheduling}
                          className="flex-1"
                        >
                          Schedule Jobs
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isTimeslipDialogOpen} onOpenChange={setIsTimeslipDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Generate Timeslip
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Generate Timeslip</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {!showDriverSelection ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !selectedTimeslipDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedTimeslipDate ? format(selectedTimeslipDate, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={selectedTimeslipDate}
                            onSelect={setSelectedTimeslipDate}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setIsTimeslipDialogOpen(false);
                          setSelectedTimeslipDate(undefined);
                          setShowDriverSelection(false);
                          setAvailableDrivers([]);
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => selectedTimeslipDate && queryDriversForDate(selectedTimeslipDate)}
                        disabled={!selectedTimeslipDate || isLoadingDrivers}
                        className="flex-1"
                      >
                        {isLoadingDrivers ? "Loading..." : "Next"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Select Driver for {selectedTimeslipDate && format(selectedTimeslipDate, "PPP")}
                      </label>
                      <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a driver" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDrivers.map((driver) => (
                            <SelectItem key={driver.driverName} value={driver.driverName}>
                              {driver.driverName} ({driver.totalOrders} orders)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setShowDriverSelection(false);
                          setSelectedDriver("");
                          setAvailableDrivers([]);
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={() => selectedDriver && generateTimeslipForDriver(selectedDriver)}
                        disabled={!selectedDriver || isGeneratingTimeslip}
                        className="flex-1"
                      >
                        {isGeneratingTimeslip ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </DashboardHeader>

        <MultiJobTimeslotDialog
          open={isMultiJobDialogOpen}
          onOpenChange={setIsMultiJobDialogOpen}
          jobs={driverJobs}
          driverName={selectedDriverForScheduling}
          onComplete={() => {
            refetch();
            setDriverJobs([]);
            setSelectedDriverForScheduling("");
            setAvailableDriversForScheduling([]);
            setDriverSchedulingDate(undefined);
            setShowSchedulingDriverSelection(false);
          }}
        />

        <PostcodePolygonSearch />

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <JobMap orders={orders || []} />
            </div>
            
            <div className="mb-8">
              <RouteBuilder orders={orders || []} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {orders?.map((order) => (
                <div key={order.id} className="space-y-4">
                  <Link to={`/orders/${order.id}`}>
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-4">
                          <StatusBadge status={order.status} />
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(order.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <p className="font-medium">{order.bike_brand} {order.bike_model}</p>
                            <p className="text-sm text-muted-foreground">Order #{order.tracking_number}</p>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="text-sm">
                              <p className="font-medium mb-1">From:</p>
                              <p className="text-muted-foreground">{formatAddress(order.sender.address)}</p>
                            </div>
                            <div className="text-sm">
                              <p className="font-medium mb-1">To:</p>
                              <p className="text-muted-foreground">{formatAddress(order.receiver.address)}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <div className="flex justify-center">
                    <ArrowDown className="text-gray-400" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-green-50 hover:shadow-md transition-shadow">
                      <CardContent className="p-3 space-y-3">
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium text-sm">Collection</h3>
                          <div className="flex items-center gap-2">
                            {order.senderPolygonSegment && (
                              <Badge 
                                variant={getPolygonBadgeVariant(order.senderPolygonSegment)}
                                className="text-xs"
                              >
                                P{order.senderPolygonSegment}
                              </Badge>
                            )}
                            {order.scheduled_pickup_date && (
                              <Badge variant="outline" className="text-xs">Scheduled</Badge>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start gap-1">
                            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">{formatAddress(order.sender.address)}</p>
                          </div>
                          {order.sender.address.lat && order.sender.address.lon && (
                            <p className="text-xs text-muted-foreground ml-4">
                              Coordinates: {order.sender.address.lat.toFixed(4)}, {order.sender.address.lon.toFixed(4)}
                            </p>
                          )}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <p>Available dates:</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDates(order.pickup_date)}
                          </p>
                          {order.scheduled_pickup_date && (
                            <p className="text-xs text-muted-foreground">
                              Scheduled Date: {format(new Date(order.scheduled_pickup_date), 'MMM d, yyyy h:mm a')}
                            </p>
                          )}
                        </div>
                        
                        {!order.scheduled_pickup_date && (
                          <JobSchedulingForm 
                            orderId={order.id} 
                            type="pickup" 
                            onScheduled={() => handleScheduled(order.id)}
                          />
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-blue-50 hover:shadow-md transition-shadow">
                      <CardContent className="p-3 space-y-3">
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium text-sm">Delivery</h3>
                          <div className="flex items-center gap-2">
                            {order.receiverPolygonSegment && (
                              <Badge 
                                variant={getPolygonBadgeVariant(order.receiverPolygonSegment)}
                                className="text-xs"
                              >
                                P{order.receiverPolygonSegment}
                              </Badge>
                            )}
                            {order.scheduled_delivery_date && (
                              <Badge variant="outline" className="text-xs">Scheduled</Badge>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start gap-1">
                            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">{formatAddress(order.receiver.address)}</p>
                          </div>
                          {order.receiver.address.lat && order.receiver.address.lon && (
                            <p className="text-xs text-muted-foreground ml-4">
                              Coordinates: {order.receiver.address.lat.toFixed(4)}, {order.receiver.address.lon.toFixed(4)}
                            </p>
                          )}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <p>Available dates:</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDates(order.delivery_date)}
                          </p>
                          {order.scheduled_delivery_date && (
                            <p className="text-xs text-muted-foreground">
                              Scheduled Date: {format(new Date(order.scheduled_delivery_date), 'MMM d, yyyy h:mm a')}
                            </p>
                          )}
                        </div>
                        
                        {!order.scheduled_delivery_date && (
                          <JobSchedulingForm 
                            orderId={order.id} 
                            type="delivery" 
                            onScheduled={() => handleScheduled(order.id)}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default JobScheduling;
