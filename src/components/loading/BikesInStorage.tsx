import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StorageAllocation } from "@/pages/LoadingUnloadingPage";
import { Order } from "@/types/order";
import { Package, MapPin, Truck } from "lucide-react";
import { format } from "date-fns";

interface BikesInStorageProps {
  bikesInStorage: { allocation: StorageAllocation; order: Order | undefined }[];
  onRemoveFromStorage: (allocationId: string) => void;
}

export const BikesInStorage = ({ bikesInStorage, onRemoveFromStorage }: BikesInStorageProps) => {
  if (bikesInStorage.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No bikes currently in storage</p>
      </div>
    );
  }

  // Sort by bay and position
  const sortedBikes = [...bikesInStorage].sort((a, b) => {
    if (a.allocation.bay !== b.allocation.bay) {
      return a.allocation.bay.localeCompare(b.allocation.bay);
    }
    return a.allocation.position - b.allocation.position;
  });

  return (
    <div className="space-y-3">{/* Removed max-h-96 overflow-y-auto */}
      {sortedBikes.map(({ allocation, order }) => {
        
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
                <Button
                  size="sm"
                  onClick={() => onRemoveFromStorage(allocation.id)}
                  className="h-7 text-xs mt-2 w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <Truck className="h-3 w-3 mr-1" />
                  Load onto Van
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};