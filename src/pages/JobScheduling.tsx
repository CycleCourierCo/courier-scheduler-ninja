import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import DashboardHeader from "@/components/DashboardHeader";
import { supabase } from "@/integrations/supabase/client";
import { ContactInfo, Address, OrderStatus } from "@/types/order";
import ClusterMap from "@/components/scheduling/ClusterMap";
import RouteBuilder from "@/components/scheduling/RouteBuilder";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cluster } from "@/services/clusteringService";
import { format } from "date-fns";
import { toast } from "sonner";

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
  order_collected: boolean | null;
  order_delivered: boolean | null;
  needs_inspection: boolean | null;
  inspection_status: 'pending' | 'inspected' | 'issues_found' | 'in_repair' | 'repaired' | null;
  shipday_pickup_id: string | null;
  shipday_delivery_id: string | null;
}

export type ShipdayVerificationResults = Record<string, boolean>;

const JobScheduling = () => {
  const [searchParams] = useSearchParams();
  const [showClusters, setShowClusters] = useState(true);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [shipdayVerification, setShipdayVerification] = useState<ShipdayVerificationResults>({});
  const [isVerifyingShipday, setIsVerifyingShipday] = useState(false);
  
  // Lifted filter state from RouteBuilder
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [showCollectedOnly, setShowCollectedOnly] = useState(false);
  
  // Initial jobs from URL parameters
  const [initialJobs, setInitialJobs] = useState<{ orderId: string; type: 'pickup' | 'delivery' }[]>([]);
  
  // Parse URL parameters on mount
  useEffect(() => {
    const jobsParam = searchParams.get('jobs');
    const dateParam = searchParams.get('date');
    
    if (jobsParam) {
      const jobs = jobsParam.split(',').map(j => {
        const [orderId, type] = j.split(':');
        return { orderId, type: type as 'pickup' | 'delivery' };
      }).filter(j => j.orderId && (j.type === 'pickup' || j.type === 'delivery'));
      setInitialJobs(jobs);
    }
    
    if (dateParam) {
      const parsedDate = new Date(dateParam);
      if (!isNaN(parsedDate.getTime())) {
        setFilterDate(parsedDate);
      }
    }
  }, [searchParams]);
  
  const { data: orders, isLoading } = useQuery({
    queryKey: ['scheduling-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, bicycle_inspections(status)')
        .not('status', 'in', '(cancelled,delivered)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data.map(order => ({
        ...order,
        sender: order.sender as ContactInfo & { address: Address },
        receiver: order.receiver as ContactInfo & { address: Address },
        status: order.status as OrderStatus,
        inspection_status: (order.bicycle_inspections as { status: string }[] | null)?.[0]?.status || null
      })) as OrderData[];
    }
  });

  // Shipday verification
  const verifyShipdayOrders = useCallback(async (ordersToVerify: OrderData[]) => {
    const shipdayIds: string[] = [];
    ordersToVerify.forEach(order => {
      if (order.shipday_pickup_id) shipdayIds.push(order.shipday_pickup_id);
      if (order.shipday_delivery_id) shipdayIds.push(order.shipday_delivery_id);
    });

    if (shipdayIds.length === 0) {
      setShipdayVerification({});
      return;
    }

    setIsVerifyingShipday(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-shipday-orders', {
        body: { shipdayIds }
      });

      if (error) throw error;
      setShipdayVerification(data.results || {});
    } catch (err) {
      console.error('Error verifying Shipday orders:', err);
      toast.error('Failed to verify Shipday orders');
    } finally {
      setIsVerifyingShipday(false);
    }
  }, []);

  // Auto-verify when orders load
  useEffect(() => {
    if (orders && orders.length > 0) {
      verifyShipdayOrders(orders);
    }
  }, [orders, verifyShipdayOrders]);
  // This ensures both ClusterMap and RouteBuilder show the same filtered data
  const filteredOrdersForMap = useMemo(() => {
    if (!orders) return [];
    
    return orders.filter(order => {
      const pickupDates = order.pickup_date as string[] | null;
      const deliveryDates = order.delivery_date as string[] | null;
      const isCollected = order.order_collected === true;
      
      // Check if order has a valid pickup job (not scheduled, and passes date filter)
      const hasUnscheduledPickup = !order.scheduled_pickup_date;
      const pickupPassesDateFilter = !filterDate || 
        !pickupDates || 
        pickupDates.length === 0 ||
        pickupDates.some(date => 
          format(new Date(date), 'yyyy-MM-dd') === format(filterDate, 'yyyy-MM-dd')
        );
      const hasValidPickup = hasUnscheduledPickup && pickupPassesDateFilter;
      
      // Check if order has a valid delivery job (not scheduled, passes date filter, and passes collected filter)
      const hasUnscheduledDelivery = !order.scheduled_delivery_date;
      const deliveryPassesDateFilter = !filterDate || 
        !deliveryDates || 
        deliveryDates.length === 0 ||
        deliveryDates.some(date => 
          format(new Date(date), 'yyyy-MM-dd') === format(filterDate, 'yyyy-MM-dd')
        );
      const deliveryPassesCollectedFilter = !showCollectedOnly || isCollected;
      const hasValidDelivery = hasUnscheduledDelivery && deliveryPassesDateFilter && deliveryPassesCollectedFilter;
      
      // Keep order if it has at least one valid job
      return hasValidPickup || hasValidDelivery;
    });
  }, [orders, filterDate, showCollectedOnly]);

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
                orders={filteredOrdersForMap} 
                showClusters={showClusters}
                onClusterChange={setClusters}
              />
            </div>
            
            <div className="mb-8">
              <RouteBuilder 
                orders={orders || []}
                filterDate={filterDate}
                showCollectedOnly={showCollectedOnly}
                onFilterDateChange={setFilterDate}
                onShowCollectedOnlyChange={setShowCollectedOnly}
                initialJobs={initialJobs}
                shipdayVerification={shipdayVerification}
                isVerifyingShipday={isVerifyingShipday}
                onReVerifyShipday={() => orders && verifyShipdayOrders(orders)}
              />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default JobScheduling;
