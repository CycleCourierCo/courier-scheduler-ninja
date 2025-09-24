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
  const [newBay, setNewBay] = useState("");
  const [newPosition, setNewPosition] = useState("");

  const handleChangeLocation = () => {
    if (!editingAllocation || !newBay || !newPosition) {
      toast.error("Please enter both bay and position");
      return;
    }

    const bayUpper = newBay.toUpperCase();
    const positionNum = parseInt(newPosition);

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

    onChangeLocation(editingAllocation.id, bayUpper, positionNum);
    setEditingAllocation(null);
    setEditingOrderAllocations([]);
    setNewBay("");
    setNewPosition("");
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
    setNewBay(allocation.bay);
    setNewPosition(allocation.position.toString());
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
                
                {editingOrderAllocations.length > 1 && (
                  <div className="p-3 bg-muted/20 rounded-lg">
                    <div className="text-sm font-medium mb-2">Current Locations:</div>
                    <div className="grid grid-cols-2 gap-2">
                      {editingOrderAllocations.map((allocation, index) => (
                        <div key={allocation.id} className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {allocation.bay}{allocation.position}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Bike {index + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="text-sm font-medium">
                  {editingOrderAllocations.length > 1 
                    ? `Changing location for bike currently at ${editingAllocation.bay}${editingAllocation.position}:` 
                    : 'New location:'
                  }
                </div>
              </div>
            )}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label htmlFor="new-bay" className="text-sm">Bay (A-D)</Label>
                <Input
                  id="new-bay"
                  value={newBay}
                  onChange={(e) => setNewBay(e.target.value.toUpperCase())}
                  placeholder="A"
                  maxLength={1}
                  className="text-center uppercase"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="new-position" className="text-sm">Position (1-15)</Label>
                <Input
                  id="new-position"
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  placeholder="1"
                  type="number"
                  min="1"
                  max="15"
                  className="text-center"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditingAllocation(null)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleChangeLocation}
                disabled={!newBay || !newPosition}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Update Location
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};