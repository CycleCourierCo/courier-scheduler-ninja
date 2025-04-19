
import React, { useEffect } from "react";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import { format } from "date-fns";
import DashboardHeader from "@/components/DashboardHeader";
import { supabase } from "@/integrations/supabase/client";
import { ContactInfo, Address, OrderStatus } from "@/types/order";
import { Separator } from "@/components/ui/separator";
import { ArrowDown, Calendar, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import JobMap from "@/components/scheduling/JobMap";
import JobSchedulingForm from "@/components/scheduling/JobSchedulingForm";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { isPointInPolygon } from "@/components/scheduling/JobMap";

export interface OrderData {
  id: string;
  status: OrderStatus;
  tracking_number: string;
  bike_brand: string | null;
  bike_model: string | null;
  created_at: string;
  sender: ContactInfo & { address: Address };
  receiver: ContactInfo & { address: Address };
  scheduled_pickup_date: string | null;
  scheduled_delivery_date: string | null;
  pickup_date: string[] | null;
  delivery_date: string[] | null;
  polygonSegment?: number;
}

// Import the polygon data from JobMap to use for segment calculation
import { segmentGeoJSON } from "@/components/scheduling/JobMap";

const JobScheduling = () => {
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['scheduling-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', [
          'scheduled_dates_pending', 
          'scheduled', 
          'collection_scheduled', 
          'delivery_scheduled'
        ])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const mappedOrders = data.map(order => ({
        ...order,
        sender: order.sender as ContactInfo & { address: Address },
        receiver: order.receiver as ContactInfo & { address: Address },
        status: order.status as OrderStatus
      })) as OrderData[];

      // Assign polygon segments to orders based on their locations
      mappedOrders.forEach(order => {
        // Try sender address first
        if (order.sender.address.lat && order.sender.address.lon) {
          order.polygonSegment = getPolygonSegment(
            order.sender.address.lat,
            order.sender.address.lon
          );
        }
        
        // If no segment found for sender, try receiver address
        if (!order.polygonSegment && order.receiver.address.lat && order.receiver.address.lon) {
          order.polygonSegment = getPolygonSegment(
            order.receiver.address.lat,
            order.receiver.address.lon
          );
        }
      });
      
      console.log("Mapped orders with segments:", mappedOrders.map(o => ({
        id: o.id, 
        polygonSegment: o.polygonSegment
      })));
      
      return mappedOrders;
    }
  });

  // Function to determine which polygon a location belongs to
  const getPolygonSegment = (lat: number, lng: number): number | null => {
    for (let i = 0; i < segmentGeoJSON.features.length; i++) {
      const polygon = segmentGeoJSON.features[i].geometry.coordinates[0];
      if (isPointInPolygon([lng, lat], polygon)) {
        return i + 1; // Segment numbers are 1-based
      }
    }
    return null;
  };

  // Debug logging to trace polygon segment assignment
  useEffect(() => {
    if (orders) {
      console.log("Orders loaded with polygon segments:", 
        orders.map(o => ({ id: o.id, polygonSegment: o.polygonSegment })));
    }
  }, [orders]);

  const formatAddress = (address: Address) => {
    return `${address.street}, ${address.city}, ${address.state} ${address.zipCode}, ${address.country}`;
  };

  const formatDates = (dates: string[] | null) => {
    if (!dates || dates.length === 0) return "No dates available";
    return dates.map(date => format(new Date(date), 'MMM d, yyyy')).join(", ");
  };

  const handleScheduled = () => {
    toast.success("Job scheduled successfully");
    refetch();
  };

  return (
    <Layout>
      <div className="container py-6">
        <DashboardHeader>
          <h1 className="text-3xl font-bold tracking-tight">Job Scheduling</h1>
          <p className="text-muted-foreground">
            Manage and schedule deliveries
          </p>
        </DashboardHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <JobMap orders={orders || []} />
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
                            {order.polygonSegment && (
                              <Badge variant="secondary" className="text-xs">
                                P{order.polygonSegment}
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
                            onScheduled={handleScheduled}
                          />
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-blue-50 hover:shadow-md transition-shadow">
                      <CardContent className="p-3 space-y-3">
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium text-sm">Delivery</h3>
                          <div className="flex items-center gap-2">
                            {order.polygonSegment && (
                              <Badge variant="secondary" className="text-xs">
                                P{order.polygonSegment}
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
                            onScheduled={handleScheduled}
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
