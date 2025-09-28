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
import { getCompletedDriverName } from "@/utils/driverAssignmentUtils";

interface PendingStorageAllocationProps {
  collectedBikes: Order[];
  storageAllocations: StorageAllocation[];
  onAllocateStorage: (orderId: string, allocations: { bay: string; position: number; bikeIndex: number }[]) => void;
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

  const handleAllocateAll = (orderId: string, bikeQuantity: number, allocatedCount: number) => {
    const remainingToAllocate = bikeQuantity - allocatedCount;
    const allocationsToMake: { bay: string; position: number; bikeIndex: number }[] = [];
    
    // Collect all allocations for this order
    for (let i = 0; i < remainingToAllocate; i++) {
      const bikeIndex = allocatedCount + i;
      const key = `${orderId}-${bikeIndex}`;
      const allocation = allocations[key];
      
      if (!allocation?.bay || !allocation?.position) {
        toast.error(`Please enter bay and position for all bikes (missing for bike ${bikeIndex + 1})`);
        return;
      }

      const bay = allocation.bay.toUpperCase();
      const position = parseInt(allocation.position);

      // Validate bay (A-D)
      if (!['A', 'B', 'C', 'D'].includes(bay)) {
        toast.error(`Bay must be A, B, C, or D (bike ${bikeIndex + 1})`);
        return;
      }

      // Validate position (1-15)
      if (isNaN(position) || position < 1 || position > 15) {
        toast.error(`Position must be between 1 and 15 (bike ${bikeIndex + 1})`);
        return;
      }

      allocationsToMake.push({ bay, position, bikeIndex });
    }

    // Check for duplicate positions within this allocation
    const positionSet = new Set();
    for (const alloc of allocationsToMake) {
      const positionKey = `${alloc.bay}${alloc.position}`;
      if (positionSet.has(positionKey)) {
        toast.error(`Cannot allocate multiple bikes to the same position: ${alloc.bay}${alloc.position}`);
        return;
      }
      positionSet.add(positionKey);
    }

    onAllocateStorage(orderId, allocationsToMake);
    
    // Clear all inputs for this order after successful allocation
    setAllocations(prev => {
      const newAllocations = { ...prev };
      for (let i = 0; i < remainingToAllocate; i++) {
        const bikeIndex = allocatedCount + i;
        const key = `${orderId}-${bikeIndex}`;
        delete newAllocations[key];
      }
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
          <Card key={bike.id} className="p-2 sm:p-4">
            <CardContent className="space-y-4 p-0">
              <div className="flex flex-col space-y-2 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
                <div className="space-y-2 min-w-0 flex-1">
                  <h4 className="font-semibold text-sm sm:text-base truncate">{bike.sender.name}</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {bike.bikeBrand} {bike.bikeModel}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{bike.sender.address.city}, {bike.sender.address.zipCode}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tracking: <span className="font-mono">{bike.trackingNumber}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {bikeQuantity} bike{bikeQuantity > 1 ? 's' : ''} total
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {remainingToAllocate} remaining to allocate
                    </Badge>
                    {(() => {
                       // Find driver name from collection completion event
                       const driverName = getCompletedDriverName(bike, 'pickup');
                      
                      if (driverName) {
                        return (
                          <Badge variant="default" className="text-xs bg-blue-600 text-white">
                            In {driverName} Van
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>
              
              {/* Show allocation inputs for each remaining bike */}
              <div className="space-y-3">
                {Array.from({ length: remainingToAllocate }, (_, index) => {
                  const bikeIndex = allocatedCount + index;
                  const key = `${bike.id}-${bikeIndex}`;
                  
                  return (
                    <div key={key} className="border rounded-lg p-2 sm:p-3 bg-muted/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs sm:text-sm font-medium">
                          Bike {bikeIndex + 1} of {bikeQuantity}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor={`bay-${key}`} className="text-xs">Bay (A-D)</Label>
                          <Input
                            id={`bay-${key}`}
                            value={allocations[key]?.bay || ''}
                            onChange={(e) => handleBayChange(key, e.target.value)}
                            placeholder="A"
                            maxLength={1}
                            className="text-center uppercase h-8 sm:h-9"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`position-${key}`} className="text-xs">Position (1-15)</Label>
                          <Input
                            id={`position-${key}`}
                            value={allocations[key]?.position || ''}
                            onChange={(e) => handlePositionChange(key, e.target.value)}
                            placeholder="1"
                            type="number"
                            min="1"
                            max="15"
                            className="text-center h-8 sm:h-9"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Single allocate button for all bikes */}
                <Button 
                  onClick={() => handleAllocateAll(bike.id, bikeQuantity, allocatedCount)}
                  size="sm"
                  disabled={!Array.from({ length: remainingToAllocate }, (_, index) => {
                    const bikeIndex = allocatedCount + index;
                    const key = `${bike.id}-${bikeIndex}`;
                    return allocations[key]?.bay && allocations[key]?.position;
                  }).every(Boolean)}
                  className="w-full bg-green-600 hover:bg-green-700 text-xs sm:text-sm"
                >
                  Allocate All {remainingToAllocate} Bike{remainingToAllocate > 1 ? 's' : ''}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};