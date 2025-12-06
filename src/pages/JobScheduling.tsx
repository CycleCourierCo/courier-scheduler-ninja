import React, { useState } from "react";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import DashboardHeader from "@/components/DashboardHeader";
import { supabase } from "@/integrations/supabase/client";
import { ContactInfo, Address, OrderStatus } from "@/types/order";
import ClusterMap from "@/components/scheduling/ClusterMap";
import RouteBuilder from "@/components/scheduling/RouteBuilder";
import WeeklyRoutePlanner from "@/components/scheduling/WeeklyRoutePlanner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cluster } from "@/services/clusteringService";

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
}

const JobScheduling = () => {
  const [showClusters, setShowClusters] = useState(true);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['scheduling-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .not('status', 'in', '(cancelled,delivered)')
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

  return (
    <Layout>
      <div className="container py-6">
        <DashboardHeader>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Job Scheduling</h1>
            <p className="text-muted-foreground">
              Manage and schedule deliveries with K-means clustering
            </p>
          </div>
        </DashboardHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Cluster Toggle */}
            <div className="flex items-center space-x-2 mb-4">
              <Switch
                id="cluster-mode"
                checked={showClusters}
                onCheckedChange={setShowClusters}
              />
              <Label htmlFor="cluster-mode">
                Show K-means Clusters
              </Label>
            </div>
            
            <div className="mb-8">
              <ClusterMap 
                orders={orders || []} 
                showClusters={showClusters}
                onClusterChange={setClusters}
              />
            </div>
            
            <div className="mb-8">
              <RouteBuilder orders={orders || []} />
            </div>

            <div className="mb-8">
              <WeeklyRoutePlanner 
                orders={orders || []} 
                onScheduleApplied={refetch}
                clusters={clusters}
              />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default JobScheduling;
