
import React from "react";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import { format } from "date-fns";
import DashboardHeader from "@/components/DashboardHeader";
import { supabase } from "@/integrations/supabase/client";
import { ContactInfo, Address, OrderStatus } from "@/types/order";
import { Separator } from "@/components/ui/separator";
import { ArrowDown, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import JobMap from "@/components/scheduling/JobMap";
import JobSchedulingForm from "@/components/scheduling/JobSchedulingForm";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
}

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
      
      return data.map(order => ({
        ...order,
        sender: order.sender as ContactInfo & { address: Address },
        receiver: order.receiver as ContactInfo & { address: Address },
        status: order.status as OrderStatus
      })) as OrderData[];
    }
  });

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

                          {order.status === 'scheduled' && order.scheduled_pickup_date && order.scheduled_delivery_date && (
                            <div className="text-sm text-muted-foreground">
                              <p>Pickup: {format(new Date(order.scheduled_pickup_date), 'MMM d, yyyy')}</p>
                              <p>Delivery: {format(new Date(order.scheduled_delivery_date), 'MMM d, yyyy')}</p>
                            </div>
                          )}
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
                          {order.scheduled_pickup_date && (
                            <Badge variant="outline" className="text-xs">Scheduled</Badge>
                          )}
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">{formatAddress(order.sender.address)}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <p>Available dates:</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDates(order.pickup_date)}
                          </p>
                          <p>Pickup: {format(new Date(order.scheduled_pickup_date), 'MMM d, yyyy')}</p>
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
                          {order.scheduled_delivery_date && (
                            <Badge variant="outline" className="text-xs">Scheduled</Badge>
                          )}
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">{formatAddress(order.receiver.address)}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <p>Available dates:</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDates(order.delivery_date)}
                          </p>
                          <p>Delivery: {format(new Date(order.scheduled_delivery_date), 'MMM d, yyyy')}</p>
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
