import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StorageAllocation } from "@/pages/LoadingUnloadingPage";
import { Order } from "@/types/order";
import { Package, MapPin, Truck, Edit, Clock, Printer, Image, Wrench, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { getCompletedDriverName, getDriverAssignment } from "@/utils/driverAssignmentUtils";
import { generateSingleOrderLabel } from "@/utils/labelUtils";
import { useStorageBays, getBayMaxPosition } from "@/hooks/useStorageBays";

import { ChangeStorageLocationDialog } from "@/components/loading/ChangeStorageLocationDialog";
import { getOrderCollectionPhotos } from "@/utils/collectionPhotos";

// Collection images come from the pickup-leg proof-of-delivery photos
const getCollectionImages = (order: Order | undefined): string[] => getOrderCollectionPhotos(order);


interface BikesInStorageProps {
  bikesInStorage: { allocation: StorageAllocation; order: Order | undefined }[];
  onRemoveFromStorage: (allocationId: string) => void;
  onRemoveAllBikesFromOrder: (orderId: string) => void;
  onChangeLocation: (allocationId: string, newBay: string, newPosition: number) => void;
  isAdmin?: boolean;
}

export const BikesInStorage = ({ bikesInStorage, onRemoveFromStorage, onRemoveAllBikesFromOrder, onChangeLocation, isAdmin = false }: BikesInStorageProps) => {
  const [editingAllocation, setEditingAllocation] = useState<StorageAllocation | null>(null);
  const [editingOrderAllocations, setEditingOrderAllocations] = useState<StorageAllocation[]>([]);
  const [imageDialogOrder, setImageDialogOrder] = useState<Order | null>(null);

  const handleChangeLocation = (locations: { bay: string; position: number }[]) => {
    editingOrderAllocations.forEach((allocation, index) => {
      const next = locations[index];
      if (!next) return;
      onChangeLocation(allocation.id, next.bay, next.position);
    });

    toast.success(
      editingOrderAllocations.length > 1
        ? `Updated locations for all ${editingOrderAllocations.length} bikes`
        : "Location updated successfully"
    );

    setEditingAllocation(null);
    setEditingOrderAllocations([]);
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
        const daysInStorage = differenceInDays(new Date(), allocations[0].allocatedAt);
        
        return (
          <Card key={orderId} className="p-2 sm:p-3">
            <CardContent className="space-y-3 p-0">
              <Collapsible defaultOpen={false} className="group/bike space-y-3">
                <CollapsibleTrigger className="w-full flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-left hover:bg-muted/40 rounded-sm p-1 -m-1">
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]/bike:-rotate-90 sm:hidden" />
                <div className="flex items-center gap-2 flex-wrap">
                  {isMultiBike ? (
                    <div className="flex flex-wrap gap-1">
                      {allocations.map((allocation) => (
                        <Badge key={allocation.id} variant="secondary" className="font-mono text-xs">
                          {allocation.bay}{allocation.position}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <Badge variant="secondary" className="font-mono text-xs">
                      {allocations[0].bay}{allocations[0].position}
                    </Badge>
                  )}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <h4 className="font-medium text-sm truncate">{allocations[0].customerName}</h4>
                    <p className="text-xs text-muted-foreground truncate">
                      {allocations[0].bikeBrand} {allocations[0].bikeModel}
                      {order?.trackingNumber && (
                        <>
                          {" • "}
                          <span className="font-mono">{order.trackingNumber}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge
                    variant={daysInStorage > 7 ? "destructive" : daysInStorage > 3 ? "default" : "secondary"}
                    className="text-xs flex items-center gap-1"
                  >
                    <Clock className="h-3 w-3" />
                    {daysInStorage} {daysInStorage === 1 ? 'day' : 'days'}
                  </Badge>
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
                     // Find driver name from collection completion event
                     const collectionDriverName = getCompletedDriverName(order, 'pickup');
                     // Get delivery driver name from order column
                     const deliveryDriverName = order.delivery_driver_name;
                    
                    return (
                      <div className="flex flex-wrap gap-1">
                        {collectionDriverName && (
                          <Badge variant="default" className="text-xs bg-blue-600 text-white">
                            Collected by {collectionDriverName}
                          </Badge>
                        )}
                        {deliveryDriverName && (
                          <Badge variant="default" className="text-xs bg-orange-600 text-white">
                            Load onto {deliveryDriverName} van
                          </Badge>
                        )}
                      </div>
                    );
                  })()}
                  {/* Inspection Status Badge */}
                  {order?.needsInspection && (() => {
                    const isComplete = order.inspection_status === 'inspected' || order.inspection_status === 'repaired';
                    return (
                      <Badge className={`text-xs flex items-center gap-1 ${
                        isComplete 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                      }`}>
                        <Wrench className="h-3 w-3" />
                        {isComplete ? 'Inspection Done' : 'Inspection Pending'}
                      </Badge>
                    );
                  })()}
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="text-sm text-muted-foreground">
                <p className="font-medium">
                  {allocations[0].bikeBrand} {allocations[0].bikeModel}
                  {isAdmin && order?.bikeValue ? ` • £${order.bikeValue.toLocaleString()}` : ''}
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
                <div className="flex flex-col gap-2 mt-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(allocations[0])}
                      className="h-9 text-xs flex-1 min-h-[44px]"
                    >
                      <Edit className="h-3 w-3 sm:mr-1" />
                      <span className="hidden sm:inline ml-1">
                        {isMultiBike ? 'Manage Locations' : 'Change Location'}
                      </span>
                      <span className="sm:hidden ml-1">
                        {isMultiBike ? 'Manage' : 'Change'}
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (isMultiBike) {
                          onRemoveAllBikesFromOrder(orderId);
                        } else {
                          onRemoveFromStorage(allocations[0].id);
                        }
                      }}
                      className="h-9 text-xs flex-1 min-h-[44px] bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Truck className="h-3 w-3 sm:mr-1" />
                      <span className="hidden sm:inline ml-1">
                        {isMultiBike ? `Load All ${allocations.length}` : 'Load onto Van'}
                      </span>
                      <span className="sm:hidden ml-1">
                        Load {isMultiBike ? `All ${allocations.length}` : ''}
                      </span>
                    </Button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => order && generateSingleOrderLabel(order)}
                      disabled={!order}
                      className="h-9 text-xs flex-1 min-h-[44px] border-blue-500 text-blue-600 hover:bg-blue-50"
                    >
                      <Printer className="h-3 w-3 sm:mr-1" />
                      <span className="ml-1">Print Label</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => order && setImageDialogOrder(order)}
                      disabled={!order || getCollectionImages(order).length === 0}
                      className="h-9 text-xs flex-1 min-h-[44px]"
                    >
                      <Image className="h-3 w-3 sm:mr-1" />
                      <span className="ml-1">See Image</span>
                    </Button>
                  </div>
                </div>
                </div>
              </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        );
      })}
      
      {/* Change Location Dialog */}
      <ChangeStorageLocationDialog
        open={!!editingAllocation}
        onOpenChange={(open) => {
          if (!open) {
            setEditingAllocation(null);
            setEditingOrderAllocations([]);
          }
        }}
        subtitle={
          editingAllocation
            ? `Order: ${editingAllocation.customerName} - ${editingAllocation.bikeBrand} ${editingAllocation.bikeModel}`
            : undefined
        }
        initialLocations={editingOrderAllocations.map((a) => ({ bay: a.bay, position: a.position }))}
        onSave={handleChangeLocation}
      />

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