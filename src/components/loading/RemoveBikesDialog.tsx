import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Order } from "@/types/order";
import { StorageAllocation } from "@/pages/LoadingUnloadingPage";
import { Truck, MapPin } from "lucide-react";
import { toast } from "sonner";

interface RemoveBikesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bikesForDelivery: Order[];
  storageAllocations: StorageAllocation[];
  onRemoveFromStorage: (allocationIds: string[]) => void;
}

export const RemoveBikesDialog = ({
  open,
  onOpenChange,
  bikesForDelivery,
  storageAllocations,
  onRemoveFromStorage,
}: RemoveBikesDialogProps) => {
  const [selectedAllocations, setSelectedAllocations] = useState<string[]>([]);

  const getAllocationForOrder = (orderId: string) => {
    return storageAllocations.find(allocation => allocation.orderId === orderId);
  };

  const handleSelectAllocation = (allocationId: string, checked: boolean) => {
    if (checked) {
      setSelectedAllocations(prev => [...prev, allocationId]);
    } else {
      setSelectedAllocations(prev => prev.filter(id => id !== allocationId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allAllocationIds = bikesForDelivery
        .map(bike => getAllocationForOrder(bike.id)?.id)
        .filter(Boolean) as string[];
      setSelectedAllocations(allAllocationIds);
    } else {
      setSelectedAllocations([]);
    }
  };

  const handleLoadOntoVan = () => {
    if (selectedAllocations.length === 0) {
      toast.error("Please select at least one bike to load");
      return;
    }

    onRemoveFromStorage(selectedAllocations);
    setSelectedAllocations([]);
    onOpenChange(false);
  };

  const allSelected = bikesForDelivery.length > 0 && 
    selectedAllocations.length === bikesForDelivery.filter(bike => getAllocationForOrder(bike.id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Remove Bikes from Storage
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {bikesForDelivery.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No bikes scheduled for delivery</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all"
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                  />
                  <label
                    htmlFor="select-all"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Select All ({bikesForDelivery.length} bikes)
                  </label>
                </div>
                <Badge variant="outline">
                  {selectedAllocations.length} selected
                </Badge>
              </div>

              <div className="space-y-3">
                {bikesForDelivery.map((bike) => {
                  const allocation = getAllocationForOrder(bike.id);
                  if (!allocation) return null;

                  const isSelected = selectedAllocations.includes(allocation.id);

                  return (
                    <Card key={bike.id} className={`transition-colors ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => 
                              handleSelectAllocation(allocation.id, checked as boolean)
                            }
                            className="mt-1"
                          />
                          
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="font-mono">
                                  {allocation.bay}{allocation.position}
                                </Badge>
                                <h4 className="font-medium">{bike.sender.name}</h4>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {bike.status}
                              </Badge>
                            </div>
                            
                            <div className="text-sm text-muted-foreground">
                              <p className="font-medium">
                                {bike.bikeBrand} {bike.bikeModel}
                              </p>
                              <div className="flex items-center gap-1 text-xs mt-1">
                                <MapPin className="h-3 w-3" />
                                Deliver to: {bike.receiver.name}, {bike.receiver.address.city}
                              </div>
                              <p className="text-xs mt-1">
                                Tracking: {bike.trackingNumber}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleLoadOntoVan}
                  disabled={selectedAllocations.length === 0}
                >
                  Load {selectedAllocations.length} Bike(s) onto Van
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};