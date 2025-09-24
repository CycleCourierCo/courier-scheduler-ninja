import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StorageAllocation } from "@/pages/LoadingUnloadingPage";
import { Order } from "@/types/order";
import { Package, MapPin, Truck, Edit } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface BikesInStorageProps {
  bikesInStorage: { allocation: StorageAllocation; order: Order | undefined }[];
  onRemoveFromStorage: (allocationId: string) => void;
  onChangeLocation: (allocationId: string, newBay: string, newPosition: number) => void;
}

export const BikesInStorage = ({ bikesInStorage, onRemoveFromStorage, onChangeLocation }: BikesInStorageProps) => {
  const [editingAllocation, setEditingAllocation] = useState<StorageAllocation | null>(null);
  const [editingOrderAllocations, setEditingOrderAllocations] = useState<StorageAllocation[]>([]);
  const [newBays, setNewBays] = useState<string[]>([]);
  const [newPositions, setNewPositions] = useState<string[]>([]);

  const handleChangeLocation = () => {
    if (!editingOrderAllocations.length) return;

    const isMultiBike = editingOrderAllocations.length > 1;

    if (isMultiBike) {
      // Validate all fields are filled for multi-bike
      for (let i = 0; i < editingOrderAllocations.length; i++) {
        if (!newBays[i] || !newPositions[i]) {
          toast.error(`Please enter bay and position for bike ${i + 1}`);
          return;
        }
      }

      // Validate all entries
      const bayPositionSet = new Set<string>();
      for (let i = 0; i < editingOrderAllocations.length; i++) {
        const bayUpper = newBays[i].toUpperCase();
        const positionNum = parseInt(newPositions[i]);

        // Validate bay (A-D)
        if (!['A', 'B', 'C', 'D'].includes(bayUpper)) {
          toast.error(`Bike ${i + 1}: Bay must be A, B, C, or D`);
          return;
        }

        // Validate position (1-15)
        if (isNaN(positionNum) || positionNum < 1 || positionNum > 15) {
          toast.error(`Bike ${i + 1}: Position must be between 1 and 15`);
          return;
        }

        const bayPositionKey = `${bayUpper}${positionNum}`;
        
        // Check for duplicates within this order
        if (bayPositionSet.has(bayPositionKey)) {
          toast.error(`Duplicate position: Bay ${bayUpper}${positionNum}`);
          return;
        }
        bayPositionSet.add(bayPositionKey);
      }

      // Update all bike locations
      editingOrderAllocations.forEach((allocation, index) => {
        const bayUpper = newBays[index].toUpperCase();
        const positionNum = parseInt(newPositions[index]);
        onChangeLocation(allocation.id, bayUpper, positionNum);
      });

      toast.success(`Updated locations for all ${editingOrderAllocations.length} bikes`);
    } else {
      // Single bike logic
      if (!newBays[0] || !newPositions[0]) {
        toast.error("Please enter both bay and position");
        return;
      }

      const bayUpper = newBays[0].toUpperCase();
      const positionNum = parseInt(newPositions[0]);

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

      onChangeLocation(editingOrderAllocations[0].id, bayUpper, positionNum);
      toast.success("Location updated successfully");
    }

    // Reset dialog
    setEditingAllocation(null);
    setEditingOrderAllocations([]);
    setNewBays([]);
    setNewPositions([]);
  };

  const openEditDialog = (allocation: StorageAllocation) => {
    // Find all allocations for this order
    const orderAllocations = bikesInStorage
      .filter(({ allocation: a }) => a.orderId === allocation.orderId)
      .map(({ allocation }) => allocation)
      .sort((a, b) => {
        if (a.bay !== b.bay) return a.bay.localeCompare(b.bay);
        return a.position - b.position;
      });
    
    setEditingOrderAllocations(orderAllocations);
    setEditingAllocation(allocation);
    
    // Initialize arrays with current values
    const bays = orderAllocations.map(a => a.bay);
    const positions = orderAllocations.map(a => a.position.toString());
    setNewBays(bays);
    setNewPositions(positions);
  };

  if (bikesInStorage.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No bikes currently in storage</p>
      </div>
    );
  }

  // Group bikes by order to show multiple positions for multi-bike orders
  const groupedByOrder = bikesInStorage.reduce((acc, { allocation, order }) => {
    if (!acc[allocation.orderId]) {
      acc[allocation.orderId] = {
        order,
        allocations: []
      };
    }
    acc[allocation.orderId].allocations.push(allocation);
    return acc;
  }, {} as Record<string, { order: Order | undefined; allocations: StorageAllocation[] }>);

  const sortedOrders = Object.entries(groupedByOrder).sort(([, a], [, b]) => {
    // Sort by first allocation's bay and position
    const aFirst = a.allocations[0];
    const bFirst = b.allocations[0];
    if (aFirst.bay !== bFirst.bay) {
      return aFirst.bay.localeCompare(bFirst.bay);
    }
    return aFirst.position - bFirst.position;
  });

  return (
    <div className="space-y-3">
      {sortedOrders.map(([orderId, { order, allocations }]) => {
        const isMultiBike = allocations.length > 1;
        
        return (
          <Card key={orderId} className="p-3">
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isMultiBike ? (
                    <div className="flex flex-wrap gap-1">
                      {allocations.map((allocation) => (
                        <Badge key={allocation.id} variant="secondary" className="font-mono text-xs">
                          {allocation.bay}{allocation.position}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <Badge variant="secondary" className="font-mono">
                      {allocations[0].bay}{allocations[0].position}
                    </Badge>
                  )}
                  <h4 className="font-medium text-sm">{allocations[0].customerName}</h4>
                </div>
                <div className="flex items-center gap-2">
                  {isMultiBike && (
                    <Badge variant="outline" className="text-xs">
                      {allocations.length} bikes
                    </Badge>
                  )}
                  <Badge 
                    variant={order?.status === 'delivery_scheduled' ? 'default' : 'outline'}
                    className="text-xs"
                  >
                    {order?.status || 'Unknown'}
                  </Badge>
                  {(() => {
                    // Find driver name from tracking events
                    const collectionEvent = order?.trackingEvents?.shipday?.updates?.find(
                      (update: any) => update.event === 'ORDER_COMPLETED' && 
                      update.orderId?.toString() === order.trackingEvents?.shipday?.pickup_id?.toString()
                    );
                    const driverName = collectionEvent?.driverName;
                    
                    if (driverName) {
                      return (
                        <Badge variant="default" className="text-xs bg-blue-600 text-white">
                          Collected by {driverName}
                        </Badge>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">
                  {allocations[0].bikeBrand} {allocations[0].bikeModel}
                </p>
                {order && (
                  <>
                    <div className="flex items-center gap-1 text-xs mt-1">
                      <MapPin className="h-3 w-3" />
                      To: {order.receiver.address.city}, {order.receiver.address.zipCode}
                    </div>
                    <p className="text-xs mt-1">
                      Tracking: {order.trackingNumber}
                    </p>
                  </>
                )}
                <p className="text-xs mt-1">
                  Stored: {format(allocations[0].allocatedAt, 'MMM dd, yyyy HH:mm')}
                </p>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(allocations[0])}
                    className="h-7 text-xs flex-1"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    {isMultiBike ? 'Manage Locations' : 'Change Location'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      // Remove all allocations for this order
                      allocations.forEach(allocation => onRemoveFromStorage(allocation.id));
                    }}
                    className="h-7 text-xs flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Truck className="h-3 w-3 mr-1" />
                    Load All onto Van
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {/* Change Location Dialog */}
      <Dialog open={!!editingAllocation} onOpenChange={(open) => {
        if (!open) {
          setEditingAllocation(null);
          setEditingOrderAllocations([]);
          setNewBays([]);
          setNewPositions([]);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingOrderAllocations.length > 1 ? 'Manage Storage Locations' : 'Change Storage Location'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingAllocation && (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Order: <strong>{editingAllocation.customerName}</strong> - {editingAllocation.bikeBrand} {editingAllocation.bikeModel}
                </div>
                
                {editingOrderAllocations.length > 1 ? (
                  <div className="space-y-4">
                    <div className="text-sm font-medium">Update all bike locations:</div>
                    
                    {editingOrderAllocations.map((allocation, index) => (
                      <div key={allocation.id} className="border rounded-lg p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          <span className="font-medium">Bike {index + 1} of {editingOrderAllocations.length}</span>
                          <Badge variant="outline" className="font-mono text-xs">
                            Currently: {allocation.bay}{allocation.position}
                          </Badge>
                        </div>
                        
                        <div className="flex gap-3 items-end">
                          <div className="flex-1">
                            <Label htmlFor={`new-bay-${index}`} className="text-sm">Bay (A-D)</Label>
                            <Input
                              id={`new-bay-${index}`}
                              value={newBays[index] || ''}
                              onChange={(e) => {
                                const updatedBays = [...newBays];
                                updatedBays[index] = e.target.value.toUpperCase();
                                setNewBays(updatedBays);
                              }}
                              placeholder="A"
                              maxLength={1}
                              className="text-center uppercase"
                            />
                          </div>
                          <div className="flex-1">
                            <Label htmlFor={`new-position-${index}`} className="text-sm">Position (1-15)</Label>
                            <Input
                              id={`new-position-${index}`}
                              value={newPositions[index] || ''}
                              onChange={(e) => {
                                const updatedPositions = [...newPositions];
                                updatedPositions[index] = e.target.value;
                                setNewPositions(updatedPositions);
                              }}
                              placeholder="1"
                              type="number"
                              min="1"
                              max="15"
                              className="text-center"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">New location:</div>
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <Label htmlFor="new-bay" className="text-sm">Bay (A-D)</Label>
                        <Input
                          id="new-bay"
                          value={newBays[0] || ''}
                          onChange={(e) => setNewBays([e.target.value.toUpperCase()])}
                          placeholder="A"
                          maxLength={1}
                          className="text-center uppercase"
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="new-position" className="text-sm">Position (1-15)</Label>
                        <Input
                          id="new-position"
                          value={newPositions[0] || ''}
                          onChange={(e) => setNewPositions([e.target.value])}
                          placeholder="1"
                          type="number"
                          min="1"
                          max="15"
                          className="text-center"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditingAllocation(null)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleChangeLocation}
                disabled={
                  editingOrderAllocations.length > 1 
                    ? newBays.some(b => !b) || newPositions.some(p => !p)
                    : !newBays[0] || !newPositions[0]
                }
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {editingOrderAllocations.length > 1 
                  ? `Update All ${editingOrderAllocations.length} Locations` 
                  : 'Update Location'
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};