
import React from "react";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import { format } from "date-fns";
import DashboardHeader from "@/components/DashboardHeader";
import { supabase } from "@/integrations/supabase/client";

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
      return data;
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders?.map((order) => (
              <Card key={order.id} className="hover:shadow-lg transition-shadow">
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

                    {order.status === 'scheduled' && (
                      <div className="text-sm text-muted-foreground">
                        <p>Pickup: {format(new Date(order.scheduled_pickup_date), 'MMM d, yyyy')}</p>
                        <p>Delivery: {format(new Date(order.scheduled_delivery_date), 'MMM d, yyyy')}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default JobScheduling;
