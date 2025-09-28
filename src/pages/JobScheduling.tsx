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

  const generateTimeslipForDate = async (selectedDate: Date) => {
    setIsGeneratingTimeslip(true);
    try {
      // Fetch jobs for the selected date
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select(`
          *,
          orders!inner(
            scheduled_pickup_date,
            scheduled_delivery_date,
            sender,
            receiver,
            tracking_number,
            bike_brand,
            bike_model
          )
        `);

      if (error) throw error;

      // Filter jobs for the selected date
      const targetDate = format(selectedDate, 'yyyy-MM-dd');
      const filteredJobs = jobs.filter(job => {
        const order = job.orders;
        const scheduledPickup = order.scheduled_pickup_date ? format(new Date(order.scheduled_pickup_date), 'yyyy-MM-dd') : null;
        const scheduledDelivery = order.scheduled_delivery_date ? format(new Date(order.scheduled_delivery_date), 'yyyy-MM-dd') : null;
        
        return scheduledPickup === targetDate || scheduledDelivery === targetDate;
      });

      if (filteredJobs.length === 0) {
        toast.error("No jobs found for the selected date");
        return;
      }

      // Generate unique stops from jobs
      const stops = new Set<string>();
      filteredJobs.forEach(job => {
        if (job.location) {
          stops.add(job.location);
        }
      });

      const uniqueStops = Array.from(stops);
      console.log(`Jobs for ${targetDate}:`, filteredJobs.length, "jobs,", uniqueStops.length, "unique stops");

      // Calculate hours and generate timeslip
      const totalUniqueStops = uniqueStops.length;
      const drivingHours = Math.round((totalUniqueStops - 1) * 0.333);
      const stopMinutes = totalUniqueStops * 7;
      const stopHours = Math.round(stopMinutes / 60);
      const lunchHours = drivingHours >= 6 ? 1 : 0;
      const totalHours = drivingHours + stopHours + lunchHours;
      const totalPay = totalHours * 11;

      // Generate Google Maps links (split every 10 stops)
      let routeLinks = "";
      if (uniqueStops.length > 10) {
        const firstHalf = uniqueStops.slice(0, 10).map(encodeURIComponent);
        const secondHalf = uniqueStops.slice(10).map(encodeURIComponent);
        
        routeLinks = `Route 1: https://www.google.com/maps/dir/Lawden+Road,+Birmingham,+B10+0AD/${firstHalf.join('/')}/Lawden+Road,+Birmingham,+B10+0AD

Route 2: https://www.google.com/maps/dir/Lawden+Road,+Birmingham,+B10+0AD/${secondHalf.join('/')}/Lawden+Road,+Birmingham,+B10+0AD`;
      } else {
        const encodedStops = uniqueStops.map(encodeURIComponent);
        routeLinks = `Route: https://www.google.com/maps/dir/Lawden+Road,+Birmingham,+B10+0AD/${encodedStops.join('/')}/Lawden+Road,+Birmingham,+B10+0AD`;
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

      const message = `Timeslip - ${formatDate(selectedDate)}

Driving Total Hours: ${drivingHours}

Stops: ${totalUniqueStops} → ${stopMinutes}m → ${stopHours}h → round = ${stopHours}h

Lunch: ${lunchHours}h

Total Hours: ${totalHours}h

Total Pay: £${totalPay}

Jobs: ${filteredJobs.length}

${routeLinks}`;

      // Send the timeslip via WhatsApp
      const { data: whatsappData, error: whatsappError } = await supabase.functions.invoke('send-timeslip-whatsapp', {
        body: { message }
      });

      if (whatsappError) throw whatsappError;

      toast.success("Timeslip sent successfully!");
      setIsTimeslipDialogOpen(false);
      setSelectedTimeslipDate(undefined);

    } catch (error: any) {
      console.error('Error generating timeslip:', error);
      toast.error(`Failed to generate timeslip: ${error.message}`);
    } finally {
      setIsGeneratingTimeslip(false);
    }
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
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => selectedTimeslipDate && generateTimeslipForDate(selectedTimeslipDate)}
                    disabled={!selectedTimeslipDate || isGeneratingTimeslip}
                    className="flex-1"
                  >
                    {isGeneratingTimeslip ? "Generating..." : "Generate"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </DashboardHeader>

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
