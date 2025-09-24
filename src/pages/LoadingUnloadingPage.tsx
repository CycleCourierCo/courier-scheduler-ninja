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
};

const LoadingUnloadingPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [storageAllocations, setStorageAllocations] = useState<StorageAllocation[]>([]);
  const [showRemoveBikesDialog, setShowRemoveBikesDialog] = useState(false);
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

  // Get collected bikes that need storage allocation
  const collectedBikes = orders.filter(order => 
    order.status === 'collected' && 
    !storageAllocations.some(allocation => allocation.orderId === order.id)
  );

  // Get bikes due for delivery (scheduled for delivery)
  const bikesForDelivery = orders.filter(order => 
    (order.status === 'scheduled' || order.status === 'delivery_scheduled') &&
    storageAllocations.some(allocation => allocation.orderId === order.id)
  );

  const handleAllocateStorage = (orderId: string, bay: string, position: number) => {
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
      allocatedAt: new Date()
    };

    const updatedAllocations = [...storageAllocations, newAllocation];
    setStorageAllocations(updatedAllocations);
    
    // Save to localStorage
    localStorage.setItem('storageAllocations', JSON.stringify(updatedAllocations));
    
    toast.success(`Bike allocated to bay ${bay}${position}`);
  };

  const handleRemoveFromStorage = (allocationIds: string[]) => {
    const updatedAllocations = storageAllocations.filter(
      allocation => !allocationIds.includes(allocation.id)
    );
    setStorageAllocations(updatedAllocations);
    
    // Save to localStorage
    localStorage.setItem('storageAllocations', JSON.stringify(updatedAllocations));
    
    toast.success(`${allocationIds.length} bike(s) removed from storage`);
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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Truck className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Loading & Unloading</h1>
          </div>
          <Button 
            onClick={() => setShowRemoveBikesDialog(true)}
            variant="outline"
            disabled={bikesForDelivery.length === 0}
          >
            Remove Bikes from Storage
          </Button>
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
                {storageAllocations.length} bike(s) currently in storage
              </p>
            </CardHeader>
            <CardContent>
              <BikesInStorage 
                storageAllocations={storageAllocations}
                orders={orders}
              />
            </CardContent>
          </Card>
        </div>

        {/* Remove Bikes Dialog */}
        <RemoveBikesDialog
          open={showRemoveBikesDialog}
          onOpenChange={setShowRemoveBikesDialog}
          bikesForDelivery={bikesForDelivery}
          storageAllocations={storageAllocations}
          onRemoveFromStorage={handleRemoveFromStorage}
        />
      </div>
    </Layout>
  );
};

export default LoadingUnloadingPage;