import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StorageAllocation } from "@/pages/LoadingUnloadingPage";
import { Order } from "@/types/order";
import { Package, MapPin } from "lucide-react";
import { format } from "date-fns";

interface BikesInStorageProps {
  storageAllocations: StorageAllocation[];
  orders: Order[];
}

export const BikesInStorage = ({ storageAllocations, orders }: BikesInStorageProps) => {
  const getOrderForAllocation = (allocation: StorageAllocation) => {
    return orders.find(order => order.id === allocation.orderId);
  };

  if (storageAllocations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No bikes currently in storage</p>
      </div>
    );
  }

  // Sort allocations by bay and position
  const sortedAllocations = [...storageAllocations].sort((a, b) => {
    if (a.bay !== b.bay) {
      return a.bay.localeCompare(b.bay);
    }
    return a.position - b.position;
  });

  return (
    <div className="space-y-3">{/* Removed max-h-96 overflow-y-auto */}
      {sortedAllocations.map((allocation) => {
        const order = getOrderForAllocation(allocation);
        
        return (
          <Card key={allocation.id} className="p-3">
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono">
                    {allocation.bay}{allocation.position}
                  </Badge>
                  <h4 className="font-medium text-sm">{allocation.customerName}</h4>
                </div>
                <Badge 
                  variant={order?.status === 'delivery_scheduled' ? 'default' : 'outline'}
                  className="text-xs"
                >
                  {order?.status || 'Unknown'}
                </Badge>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">
                  {allocation.bikeBrand} {allocation.bikeModel}
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
                  Stored: {format(allocation.allocatedAt, 'MMM dd, yyyy HH:mm')}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};