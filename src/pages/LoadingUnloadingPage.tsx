import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StorageUnitLayout } from "@/components/loading/StorageUnitLayout";
import { PendingStorageAllocation } from "@/components/loading/PendingStorageAllocation";
import { BikesInStorage } from "@/components/loading/BikesInStorage";
import { RemoveBikesDialog } from "@/components/loading/RemoveBikesDialog";
import { getOrders } from "@/services/orderService";
import { Order } from "@/types/order";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Truck } from "lucide-react";

// Storage allocation type
export type StorageAllocation = {
  id: string;
  orderId: string;
  bay: string; // A-D
  position: number; // 1-15
  bikeBrand?: string;
  bikeModel?: string;
  customerName: string;
  allocatedAt: Date;
  bikeIndex?: number; // Track which bike this is for multi-bike orders
};

const LoadingUnloadingPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [storageAllocations, setStorageAllocations] = useState<StorageAllocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ordersData = await getOrders();
        setOrders(ordersData);
        
        // Fetch storage allocations from localStorage for now
        // In a real app, this would be from a database
        const savedAllocations = localStorage.getItem('storageAllocations');
        if (savedAllocations) {
          const allocations = JSON.parse(savedAllocations);
          setStorageAllocations(allocations.map((a: any) => ({
            ...a,
            allocatedAt: new Date(a.allocatedAt)
          })));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helper function to check if order has been collected based on tracking events
  const hasBeenCollected = (order: Order) => {
    // Check order status first
    if (order.status === 'collected' || order.status === 'driver_to_delivery') {
      return true;
    }
    
    // Check tracking events for collection indicators
    const trackingUpdates = order.trackingEvents?.shipday?.updates || [];
    return trackingUpdates.some(update => 
      update.description?.toLowerCase().includes('collected') || 
      update.description?.toLowerCase().includes('pickup') ||
      update.event === 'ORDER_POD_UPLOAD' ||
      update.status?.toLowerCase().includes('collected')
    );
  };

  // Helper function to check if order has been delivered
  const hasBeenDelivered = (order: Order) => {
    // Check order status first
    if (order.status === 'delivered') {
      return true;
    }
    
    // Check tracking events for delivery indicators
    const trackingUpdates = order.trackingEvents?.shipday?.updates || [];
    return trackingUpdates.some(update => 
      update.description?.toLowerCase().includes('delivered') || 
      update.event === 'DELIVERY_POD_UPLOAD' ||
      update.status?.toLowerCase().includes('delivered')
    );
  };

  // Get bikes that need storage allocation (collected but not delivered, not cancelled, and no storage allocation)
  const collectedBikes = orders.filter(order => 
    hasBeenCollected(order) && 
    !hasBeenDelivered(order) &&
    order.status !== 'cancelled' &&
    !storageAllocations.some(allocation => allocation.orderId === order.id)
  );

  // Get all bikes that have storage allocations (regardless of delivery status)
  const bikesInStorage = storageAllocations.map(allocation => {
    const order = orders.find(o => o.id === allocation.orderId);
    return { allocation, order };
  }).filter(item => item.order); // Only include if order still exists

  const handleAllocateStorage = (orderId: string, bay: string, position: number, bikeIndex: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Check if the bay/position is already occupied
    const isOccupied = storageAllocations.some(
      allocation => allocation.bay === bay && allocation.position === position
    );

    if (isOccupied) {
      toast.error(`Bay ${bay}${position} is already occupied`);
      return;
    }

    const newAllocation: StorageAllocation = {
      id: crypto.randomUUID(),
      orderId,
      bay,
      position,
      bikeBrand: order.bikeBrand,
      bikeModel: order.bikeModel,
      customerName: order.sender.name,
      allocatedAt: new Date(),
      bikeIndex // Add bike index to track which bike this is
    };

    const updatedAllocations = [...storageAllocations, newAllocation];
    setStorageAllocations(updatedAllocations);
    
    // Save to localStorage
    localStorage.setItem('storageAllocations', JSON.stringify(updatedAllocations));
    
    const bikeQuantity = order.bikeQuantity || 1;
    const allocatedCount = updatedAllocations.filter(a => a.orderId === orderId).length;
    
    if (allocatedCount >= bikeQuantity) {
      toast.success(`All ${bikeQuantity} bike(s) allocated for this order`);
    } else {
      toast.success(`Bike ${bikeIndex + 1} allocated to bay ${bay}${position} (${allocatedCount}/${bikeQuantity} bikes allocated)`);
    }
  };

  const handleRemoveFromStorage = (allocationId: string) => {
    const updatedAllocations = storageAllocations.filter(
      allocation => allocation.id !== allocationId
    );
    setStorageAllocations(updatedAllocations);
    
    // Save to localStorage
    localStorage.setItem('storageAllocations', JSON.stringify(updatedAllocations));
    
    toast.success('Bike loaded onto van and removed from storage');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <Truck className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Loading & Unloading</h1>
          </div>
        </div>

        {/* Storage Unit Layout */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Storage Unit Layout</CardTitle>
          </CardHeader>
          <CardContent>
            <StorageUnitLayout 
              storageAllocations={storageAllocations}
            />
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Bikes Pending Storage Allocation */}
          <Card>
            <CardHeader>
              <CardTitle>Bikes Pending Storage Allocation</CardTitle>
              <p className="text-sm text-muted-foreground">
                {collectedBikes.length} bike(s) collected and awaiting storage allocation
              </p>
            </CardHeader>
            <CardContent>
              <PendingStorageAllocation 
                collectedBikes={collectedBikes}
                storageAllocations={storageAllocations}
                onAllocateStorage={handleAllocateStorage}
              />
            </CardContent>
          </Card>

          {/* Bikes in Storage */}
          <Card>
            <CardHeader>
              <CardTitle>Bikes in Storage</CardTitle>
              <p className="text-sm text-muted-foreground">
                {bikesInStorage.length} bike(s) currently in storage
              </p>
            </CardHeader>
            <CardContent>
              <BikesInStorage 
                bikesInStorage={bikesInStorage}
                onRemoveFromStorage={handleRemoveFromStorage}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default LoadingUnloadingPage;