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
  onRemoveAllBikesFromOrder: (orderId: string) => void;
}

export const RemoveBikesDialog = ({
  open,
  onOpenChange,
  bikesForDelivery,
  storageAllocations,
  onRemoveAllBikesFromOrder,
}: RemoveBikesDialogProps) => {
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const getAllocationForOrder = (orderId: string) => {
    return storageAllocations.find(allocation => allocation.orderId === orderId);
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders(prev => [...prev, orderId]);
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allOrderIds = bikesForDelivery.map(bike => bike.id);
      setSelectedOrders(allOrderIds);
    } else {
      setSelectedOrders([]);
    }
  };

  const handleLoadOntoVan = async () => {
    if (selectedOrders.length === 0) {
      toast.error("Please select at least one bike to load");
      return;
    }

    try {
      // Load all selected orders sequentially to avoid conflicts
      for (const orderId of selectedOrders) {
        await onRemoveAllBikesFromOrder(orderId);
      }
      
      setSelectedOrders([]);
      onOpenChange(false);
    } catch (error) {
      console.error('Error loading bikes onto van:', error);
      toast.error('Failed to load some bikes onto van');
    }
  };

  const allSelected = bikesForDelivery.length > 0 && 
    selectedOrders.length === bikesForDelivery.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Truck className="h-4 w-4 sm:h-5 sm:w-5" />
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
                  {selectedOrders.length} selected
                </Badge>
              </div>

              <div className="space-y-3">
                {bikesForDelivery.map((bike) => {
                  const allocation = getAllocationForOrder(bike.id);
                  if (!allocation) return null;

                  const isSelected = selectedOrders.includes(bike.id);

                  return (
                    <Card key={bike.id} className={`transition-colors ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => 
                              handleSelectOrder(bike.id, checked as boolean)
                            }
                            className="mt-1 min-w-[20px] min-h-[20px]"
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

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
                  Cancel
                </Button>
                <Button 
                  onClick={handleLoadOntoVan}
                  disabled={selectedOrders.length === 0}
                  className="min-h-[44px]"
                >
                  Load {selectedOrders.length} Bike(s) onto Van
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};