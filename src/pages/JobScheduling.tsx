
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
import { ArrowDown } from "lucide-react";

// Define a type for the order data structure as it comes from the database
interface OrderData {
  id: string;
  status: OrderStatus; // Use OrderStatus type from types/order.ts
  tracking_number: string;
  bike_brand: string | null;
  bike_model: string | null;
  created_at: string;
  sender: ContactInfo & { address: Address };
  receiver: ContactInfo & { address: Address };
  scheduled_pickup_date: string | null;
  scheduled_delivery_date: string | null;
}

const JobScheduling = () => {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['scheduling-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['scheduled_dates_pending', 'scheduled'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Parse the sender and receiver JSON fields for each order
      return data.map(order => ({
        ...order,
        // Ensure sender and receiver are properly typed
        sender: order.sender as ContactInfo & { address: Address },
        receiver: order.receiver as ContactInfo & { address: Address },
        status: order.status as OrderStatus
      })) as OrderData[];
    }
  });

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {orders?.map((order) => (
              <div key={order.id} className="space-y-4">
                {/* Main Order Card */}
                <Card className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-4">
                      <StatusBadge status={order.status} />
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(order.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium">{order.bike_brand} {order.bike_model}</p>
                        <p className="text-sm text-muted-foreground">Order #{order.tracking_number}</p>
                      </div>
                      
                      <div className="text-sm">
                        <p><span className="font-medium">From:</span> {order.sender.address.city}</p>
                        <p><span className="font-medium">To:</span> {order.receiver.address.city}</p>
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

                {/* Connector */}
                <div className="flex justify-center">
                  <ArrowDown className="text-gray-400" />
                </div>

                {/* Jobs Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Collection Job */}
                  <Card className="bg-green-50 hover:shadow-md transition-shadow">
                    <CardContent className="p-3">
                      <h3 className="font-medium text-sm mb-2">Collection</h3>
                      <p className="text-xs text-muted-foreground">{order.sender.address.city}</p>
                      {order.scheduled_pickup_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(order.scheduled_pickup_date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Delivery Job */}
                  <Card className="bg-blue-50 hover:shadow-md transition-shadow">
                    <CardContent className="p-3">
                      <h3 className="font-medium text-sm mb-2">Delivery</h3>
                      <p className="text-xs text-muted-foreground">{order.receiver.address.city}</p>
                      {order.scheduled_delivery_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(order.scheduled_delivery_date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default JobScheduling;
