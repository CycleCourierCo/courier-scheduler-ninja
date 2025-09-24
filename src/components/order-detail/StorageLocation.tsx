import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Order } from "@/types/order";
import { StorageAllocation } from "@/pages/LoadingUnloadingPage";
import { toast } from "sonner";
import { MapPin, Package } from "lucide-react";

interface StorageLocationProps {
  order: Order;
}

export const StorageLocation = ({ order }: StorageLocationProps) => {
  const [bay, setBay] = useState("");
  const [position, setPosition] = useState("");
  const [currentAllocation, setCurrentAllocation] = useState<StorageAllocation | null>(null);
  const [allAllocations, setAllAllocations] = useState<StorageAllocation[]>([]);

  useEffect(() => {
    // Load storage allocations from localStorage
    const savedAllocations = localStorage.getItem('storageAllocations');
    if (savedAllocations) {
      const allocations = JSON.parse(savedAllocations).map((a: any) => ({
        ...a,
        allocatedAt: new Date(a.allocatedAt)
      }));
      setAllAllocations(allocations);
      
      // Find allocation for this order
      const allocation = allocations.find((a: StorageAllocation) => a.orderId === order.id);
      if (allocation) {
        setCurrentAllocation(allocation);
        setBay(allocation.bay);
        setPosition(allocation.position.toString());
      }
    }
  }, [order.id]);

  const handleAllocate = () => {
    if (!bay || !position) {
      toast.error("Please enter both bay and position");
      return;
    }

    const bayUpper = bay.toUpperCase();
    const positionNum = parseInt(position);

    // Validate bay (A-D)
    if (!['A', 'B', 'C', 'D'].includes(bayUpper)) {
      toast.error("Bay must be A, B, C, or D");
      return;
    }

    // Validate position (1-15)
    if (isNaN(positionNum) || positionNum < 1 || positionNum > 15) {
      toast.error("Position must be between 1 and 15");
      return;
    }

    // Check if the bay/position is already occupied by another bike
    const isOccupied = allAllocations.some(
      allocation => 
        allocation.bay === bayUpper && 
        allocation.position === positionNum &&
        allocation.orderId !== order.id // Don't count current order's allocation
    );

    if (isOccupied) {
      toast.error(`Bay ${bayUpper}${positionNum} is already occupied`);
      return;
    }

    // Remove existing allocation for this order if any
    const updatedAllocations = allAllocations.filter(a => a.orderId !== order.id);

    // Create new allocation
    const newAllocation: StorageAllocation = {
      id: crypto.randomUUID(),
      orderId: order.id,
      bay: bayUpper,
      position: positionNum,
      bikeBrand: order.bikeBrand,
      bikeModel: order.bikeModel,
      customerName: order.sender.name,
      allocatedAt: new Date()
    };

    const finalAllocations = [...updatedAllocations, newAllocation];
    setAllAllocations(finalAllocations);
    setCurrentAllocation(newAllocation);
    
    // Save to localStorage
    localStorage.setItem('storageAllocations', JSON.stringify(finalAllocations));
    
    toast.success(`Bike allocated to bay ${bayUpper}${positionNum}`);
  };

  const handleRemove = () => {
    if (!currentAllocation) return;

    const updatedAllocations = allAllocations.filter(a => a.id !== currentAllocation.id);
    setAllAllocations(updatedAllocations);
    setCurrentAllocation(null);
    setBay("");
    setPosition("");
    
    // Save to localStorage
    localStorage.setItem('storageAllocations', JSON.stringify(updatedAllocations));
    
    toast.success("Bike removed from storage");
  };

  // Check if order has been collected
  const hasBeenCollected = (order: Order) => {
    if (order.status === 'collected' || order.status === 'driver_to_delivery') {
      return true;
    }
    
    const trackingUpdates = order.trackingEvents?.shipday?.updates || [];
    return trackingUpdates.some(update => 
      update.description?.toLowerCase().includes('collected') || 
      update.description?.toLowerCase().includes('pickup') ||
      update.event === 'ORDER_POD_UPLOAD' ||
      update.status?.toLowerCase().includes('collected')
    );
  };

  // Only show storage location for collected bikes
  if (!hasBeenCollected(order)) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Storage Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentAllocation ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-lg px-3 py-1">
                {currentAllocation.bay}{currentAllocation.position}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Stored: {currentAllocation.allocatedAt.toLocaleDateString()} at {currentAllocation.allocatedAt.toLocaleTimeString()}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Bay {currentAllocation.bay}, Position {currentAllocation.position}
              </span>
            </div>
            
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleRemove}
            >
              Remove from Storage
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              This bike has been collected but not yet allocated to storage.
            </div>
            
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label htmlFor="bay" className="text-sm">Bay (A-D)</Label>
                <Input
                  id="bay"
                  value={bay}
                  onChange={(e) => setBay(e.target.value.toUpperCase())}
                  placeholder="A"
                  maxLength={1}
                  className="text-center uppercase"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="position" className="text-sm">Position (1-15)</Label>
                <Input
                  id="position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="1"
                  type="number"
                  min="1"
                  max="15"
                  className="text-center"
                />
              </div>
              <Button 
                onClick={handleAllocate}
                disabled={!bay || !position}
                className="bg-green-600 hover:bg-green-700"
              >
                Allocate
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};