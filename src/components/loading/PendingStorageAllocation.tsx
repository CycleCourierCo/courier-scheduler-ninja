import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Order } from "@/types/order";
import { StorageAllocation } from "@/pages/LoadingUnloadingPage";
import { toast } from "sonner";
import { Package, MapPin } from "lucide-react";

interface PendingStorageAllocationProps {
  collectedBikes: Order[];
  storageAllocations: StorageAllocation[];
  onAllocateStorage: (orderId: string, bay: string, position: number, bikeIndex: number) => void;
}

export const PendingStorageAllocation = ({ 
  collectedBikes, 
  storageAllocations, 
  onAllocateStorage 
}: PendingStorageAllocationProps) => {
  const [allocations, setAllocations] = useState<{ [key: string]: { bay: string; position: string } }>({});

  const handleBayChange = (key: string, bay: string) => {
    setAllocations(prev => ({
      ...prev,
      [key]: { ...prev[key], bay: bay.toUpperCase() }
    }));
  };

  const handlePositionChange = (key: string, position: string) => {
    setAllocations(prev => ({
      ...prev,
      [key]: { ...prev[key], position }
    }));
  };

  const handleAllocate = (orderId: string, bikeIndex: number) => {
    const key = `${orderId}-${bikeIndex}`;
    const allocation = allocations[key];
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

    onAllocateStorage(orderId, bay, position, bikeIndex);
    
    // Clear the input after successful allocation
    setAllocations(prev => {
      const newAllocations = { ...prev };
      delete newAllocations[key];
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
      {collectedBikes.map((bike) => {
        const bikeQuantity = bike.bikeQuantity || 1;
        const allocatedCount = storageAllocations.filter(a => a.orderId === bike.id).length;
        const remainingToAllocate = bikeQuantity - allocatedCount;
        
        if (remainingToAllocate <= 0) return null; // All bikes already allocated
        
        return (
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
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {bikeQuantity} bike{bikeQuantity > 1 ? 's' : ''} total
                    </Badge>
                    <Badge variant="outline">
                      {remainingToAllocate} remaining to allocate
                    </Badge>
                  </div>
                </div>
              </div>
              
              {/* Show allocation inputs for each remaining bike */}
              <div className="space-y-3">
                {Array.from({ length: remainingToAllocate }, (_, index) => {
                  const bikeIndex = allocatedCount + index;
                  const key = `${bike.id}-${bikeIndex}`;
                  
                  return (
                    <div key={key} className="border rounded-lg p-3 bg-muted/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Bike {bikeIndex + 1} of {bikeQuantity}
                        </span>
                      </div>
                      
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label htmlFor={`bay-${key}`} className="text-xs">Bay (A-D)</Label>
                          <Input
                            id={`bay-${key}`}
                            value={allocations[key]?.bay || ''}
                            onChange={(e) => handleBayChange(key, e.target.value)}
                            placeholder="A"
                            maxLength={1}
                            className="text-center uppercase"
                          />
                        </div>
                        <div className="flex-1">
                          <Label htmlFor={`position-${key}`} className="text-xs">Position (1-15)</Label>
                          <Input
                            id={`position-${key}`}
                            value={allocations[key]?.position || ''}
                            onChange={(e) => handlePositionChange(key, e.target.value)}
                            placeholder="1"
                            type="number"
                            min="1"
                            max="15"
                            className="text-center"
                          />
                        </div>
                        <Button 
                          onClick={() => handleAllocate(bike.id, bikeIndex)}
                          size="sm"
                          disabled={!allocations[key]?.bay || !allocations[key]?.position}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Allocate
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};