import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Order } from "@/types/order";
import { StorageAllocation } from "@/pages/LoadingUnloadingPage";
import { toast } from "sonner";
import { Package, MapPin } from "lucide-react";

interface PendingStorageAllocationProps {
  collectedBikes: Order[];
  storageAllocations: StorageAllocation[];
  onAllocateStorage: (orderId: string, bay: string, position: number) => void;
}

export const PendingStorageAllocation = ({ 
  collectedBikes, 
  storageAllocations, 
  onAllocateStorage 
}: PendingStorageAllocationProps) => {
  const [allocations, setAllocations] = useState<{ [orderId: string]: { bay: string; position: string } }>({});

  const handleBayChange = (orderId: string, bay: string) => {
    setAllocations(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], bay: bay.toUpperCase() }
    }));
  };

  const handlePositionChange = (orderId: string, position: string) => {
    setAllocations(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], position }
    }));
  };

  const handleAllocate = (orderId: string) => {
    const allocation = allocations[orderId];
    if (!allocation?.bay || !allocation?.position) {
      toast.error("Please enter both bay and position");
      return;
    }

    const bay = allocation.bay.toUpperCase();
    const position = parseInt(allocation.position);

    // Validate bay (A-D)
    if (!['A', 'B', 'C', 'D'].includes(bay)) {
      toast.error("Bay must be A, B, C, or D");
      return;
    }

    // Validate position (1-15)
    if (isNaN(position) || position < 1 || position > 15) {
      toast.error("Position must be between 1 and 15");
      return;
    }

    onAllocateStorage(orderId, bay, position);
    
    // Clear the input after successful allocation
    setAllocations(prev => {
      const newAllocations = { ...prev };
      delete newAllocations[orderId];
      return newAllocations;
    });
  };

  if (collectedBikes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No bikes pending storage allocation</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {collectedBikes.map((bike) => (
        <Card key={bike.id} className="p-4">
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <h4 className="font-semibold">{bike.sender.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {bike.bikeBrand} {bike.bikeModel}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {bike.sender.address.city}, {bike.sender.address.zipCode}
                </div>
                <p className="text-xs text-muted-foreground">
                  Tracking: {bike.trackingNumber}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label htmlFor={`bay-${bike.id}`} className="text-xs">Bay (A-D)</Label>
                <Input
                  id={`bay-${bike.id}`}
                  value={allocations[bike.id]?.bay || ''}
                  onChange={(e) => handleBayChange(bike.id, e.target.value)}
                  placeholder="A"
                  maxLength={1}
                  className="text-center uppercase"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor={`position-${bike.id}`} className="text-xs">Position (1-15)</Label>
                <Input
                  id={`position-${bike.id}`}
                  value={allocations[bike.id]?.position || ''}
                  onChange={(e) => handlePositionChange(bike.id, e.target.value)}
                  placeholder="1"
                  type="number"
                  min="1"
                  max="15"
                  className="text-center"
                />
              </div>
              <Button 
                onClick={() => handleAllocate(bike.id)}
                size="sm"
                disabled={!allocations[bike.id]?.bay || !allocations[bike.id]?.position}
              >
                Allocate
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};