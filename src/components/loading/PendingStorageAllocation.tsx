import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Order } from "@/types/order";
import { StorageAllocation } from "@/pages/LoadingUnloadingPage";
import { toast } from "sonner";
import { Package, MapPin, Truck, Printer, Image } from "lucide-react";
import { getCompletedDriverName } from "@/utils/driverAssignmentUtils";
import { generateSingleOrderLabel } from "@/utils/labelUtils";

// Helper to extract collection images from tracking events
const getCollectionImages = (order: Order | undefined): string[] => {
  if (!order?.trackingEvents?.shipday?.updates) return [];
  
  const pickupId = order.trackingEvents?.shipday?.pickup_id?.toString();
  
  // Find collection events with POD images
  const collectionEvent = order.trackingEvents.shipday.updates.find(
    (update: any) => 
      (update.event === 'ORDER_COMPLETED' || update.event === 'ORDER_POD_UPLOAD') &&
      update.orderId === pickupId &&
      update.podUrls && update.podUrls.length > 0
  );
  
  return collectionEvent?.podUrls || [];
};

interface PendingStorageAllocationProps {
  collectedBikes: Order[];
  bikesLoadedOntoVan: Order[];
  storageAllocations: StorageAllocation[];
  onAllocateStorage: (orderId: string, allocations: { bay: string; position: number; bikeIndex: number }[]) => void;
}

export const PendingStorageAllocation = ({ 
  collectedBikes, 
  bikesLoadedOntoVan,
  storageAllocations, 
  onAllocateStorage 
}: PendingStorageAllocationProps) => {
  const [allocations, setAllocations] = useState<{ [key: string]: { bay: string; position: string } }>({});
  const [imageDialogOrder, setImageDialogOrder] = useState<Order | null>(null);

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

      // Validate position (1-20)
      if (isNaN(position) || position < 1 || position > 20) {
        toast.error(`Position must be between 1 and 20 (bike ${bikeIndex + 1})`);
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

  if (collectedBikes.length === 0 && bikesLoadedOntoVan.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No bikes pending storage allocation or loaded onto van</p>
      </div>
    );
  }

  // Group collected bikes by collection driver
  const collectedByDriver = collectedBikes.reduce((groups, bike) => {
    const driverName = getCompletedDriverName(bike, 'pickup') || 'No Driver Assigned';
    if (!groups[driverName]) {
      groups[driverName] = [];
    }
    groups[driverName].push(bike);
    return groups;
  }, {} as Record<string, Order[]>);

  // Group loaded bikes by delivery driver
  const loadedByDriver = bikesLoadedOntoVan.reduce((groups, bike) => {
    const driverName = bike.delivery_driver_name || 'No Driver Assigned';
    if (!groups[driverName]) {
      groups[driverName] = [];
    }
    groups[driverName].push(bike);
    return groups;
  }, {} as Record<string, Order[]>);

  // Combine all driver names and sort
  const allDriverNames = [...new Set([...Object.keys(collectedByDriver), ...Object.keys(loadedByDriver)])].sort((a, b) => {
    if (a === 'No Driver Assigned') return 1;
    if (b === 'No Driver Assigned') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      {allDriverNames.map((driverName) => {
        const collectedForDriver = collectedByDriver[driverName] || [];
        const loadedForDriver = loadedByDriver[driverName] || [];
        const totalBikes = collectedForDriver.length + loadedForDriver.length;

        return (
          <div key={driverName} className="space-y-3">
            {/* Driver Section Header */}
            <div className="flex items-center gap-2 pt-2 pb-2 border-b border-border">
              <Truck className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-lg">{driverName}</h3>
              <Badge variant="secondary">
                {totalBikes} bike{totalBikes > 1 ? 's' : ''}
              </Badge>
              {loadedForDriver.length > 0 && (
                <Badge variant="success" className="text-xs">
                  {loadedForDriver.length} on van
                </Badge>
              )}
            </div>

            {/* Bikes loaded onto van (simplified cards - no allocation) */}
            {loadedForDriver.map((bike) => (
              <Card key={bike.id} className="p-2 sm:p-4 bg-success/10 border-success/30">
                <CardContent className="space-y-4 p-0">
                  <div className="flex flex-col space-y-2 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
                    <div className="space-y-2 min-w-0 flex-1">
                      <h4 className="font-semibold text-sm sm:text-base truncate">{bike.sender.name}</h4>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {bike.bikeBrand} {bike.bikeModel}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{bike.receiver.address.city}, {bike.receiver.address.zipCode}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Tracking: <span className="font-mono">{bike.trackingNumber}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="success" className="text-xs">
                          <Truck className="h-3 w-3 mr-1" />
                          Loaded onto Van
                        </Badge>
                        {bike.bikeQuantity && bike.bikeQuantity > 1 && (
                          <Badge variant="secondary" className="text-xs">
                            {bike.bikeQuantity} bikes
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Print Label and See Image buttons */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateSingleOrderLabel(bike)}
                      className="h-9 text-xs flex-1 min-h-[44px] border-primary text-primary hover:bg-primary/10"
                    >
                      <Printer className="h-3 w-3 sm:mr-1" />
                      <span className="ml-1">Print Label</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setImageDialogOrder(bike)}
                      disabled={getCollectionImages(bike).length === 0}
                      className="h-9 text-xs flex-1 min-h-[44px]"
                    >
                      <Image className="h-3 w-3 sm:mr-1" />
                      <span className="ml-1">See Image</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Bikes pending storage allocation (with inputs) */}
            {collectedForDriver.map((bike) => {
              const bikeQuantity = bike.bikeQuantity || 1;
              const allocatedCount = storageAllocations.filter(a => a.orderId === bike.id).length;
              const remainingToAllocate = bikeQuantity - allocatedCount;
              
              if (remainingToAllocate <= 0) return null;
              
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
                            const collectionDriverName = getCompletedDriverName(bike, 'pickup');
                            if (collectionDriverName) {
                              return (
                                <Badge variant="active" className="text-xs">
                                  In {collectionDriverName} Van
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                          {bike.delivery_driver_name && (
                            <Badge variant="warning" className="text-xs">
                              Load onto {bike.delivery_driver_name} van
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Print Label and See Image buttons */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateSingleOrderLabel(bike)}
                        className="h-9 text-xs flex-1 min-h-[44px] border-primary text-primary hover:bg-primary/10"
                      >
                        <Printer className="h-3 w-3 sm:mr-1" />
                        <span className="ml-1">Print Label</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setImageDialogOrder(bike)}
                        disabled={getCollectionImages(bike).length === 0}
                        className="h-9 text-xs flex-1 min-h-[44px]"
                      >
                        <Image className="h-3 w-3 sm:mr-1" />
                        <span className="ml-1">See Image</span>
                      </Button>
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
                                <Label htmlFor={`position-${key}`} className="text-xs">Position (1-20)</Label>
                                <Input
                                  id={`position-${key}`}
                                  value={allocations[key]?.position || ''}
                                  onChange={(e) => handlePositionChange(key, e.target.value)}
                                  placeholder="1"
                                  type="number"
                                  min="1"
                                  max="20"
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
                        className="w-full bg-primary hover:bg-primary/90 text-xs sm:text-sm"
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
      })}

      {/* Collection Images Dialog */}
      <Dialog open={!!imageDialogOrder} onOpenChange={(open) => !open && setImageDialogOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Collection Photos - {imageDialogOrder?.sender?.name || 'Unknown'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {imageDialogOrder && getCollectionImages(imageDialogOrder).length > 0 ? (
              <div className="grid gap-4">
                {getCollectionImages(imageDialogOrder).map((url, index) => (
                  <div key={index} className="rounded-lg overflow-hidden border">
                    <img 
                      src={url} 
                      alt={`Collection photo ${index + 1}`} 
                      className="w-full h-auto object-contain max-h-[400px]"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No collection images available yet</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};