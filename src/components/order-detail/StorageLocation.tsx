import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Order } from "@/types/order";
import { StorageAllocation } from "@/pages/LoadingUnloadingPage";
import { toast } from "sonner";
import { MapPin, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StorageLocationProps {
  order: Order;
}

export const StorageLocation = ({ order }: StorageLocationProps) => {
  const [bays, setBays] = useState<string[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [allAllocations, setAllAllocations] = useState<StorageAllocation[]>([]);

  useEffect(() => {
    const loadStorageAllocations = () => {
      // Load from order's storage_locations field
      const storageLocations = order.storage_locations as StorageAllocation[] | null;
      if (storageLocations && storageLocations.length > 0) {
        const allocations = storageLocations.map((a: any) => ({
          ...a,
          allocatedAt: new Date(a.allocatedAt)
        }));
        setAllAllocations(allocations);
        
        const bikeQuantity = order.bikeQuantity || 1;
        
        // Initialize form arrays
        const newBays = Array(bikeQuantity).fill('');
        const newPositions = Array(bikeQuantity).fill('');
        
        // Fill existing allocations
        allocations.forEach((allocation, index) => {
          if (index < bikeQuantity) {
            newBays[index] = allocation.bay;
            newPositions[index] = allocation.position.toString();
          }
        });
        
        setBays(newBays);
        setPositions(newPositions);
      } else {
        // Initialize empty arrays
        const bikeQuantity = order.bikeQuantity || 1;
        setBays(Array(bikeQuantity).fill(''));
        setPositions(Array(bikeQuantity).fill(''));
        setAllAllocations([]);
      }
    };

    loadStorageAllocations();
  }, [order.id, order.bikeQuantity, order.storage_locations]);

  const handleAllocate = () => {
    const bikeQuantity = order.bikeQuantity || 1;
    
    // Validate all fields are filled
    for (let i = 0; i < bikeQuantity; i++) {
      if (!bays[i] || !positions[i]) {
        toast.error(`Please enter bay and position for bike ${i + 1}`);
        return;
      }
    }

    const newAllocations: StorageAllocation[] = [];
    const bayPositionSet = new Set<string>();

    // Validate and prepare allocations
    for (let i = 0; i < bikeQuantity; i++) {
      const bayUpper = bays[i].toUpperCase();
      const positionNum = parseInt(positions[i]);

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

      // Check if the bay/position is already occupied by another order
      const isOccupied = allAllocations.some(
        allocation => 
          allocation.bay === bayUpper && 
          allocation.position === positionNum &&
          allocation.orderId !== order.id
      );

      if (isOccupied) {
        toast.error(`Bay ${bayUpper}${positionNum} is already occupied`);
        return;
      }

      // Create allocation for this bike
      newAllocations.push({
        id: crypto.randomUUID(),
        orderId: order.id,
        bay: bayUpper,
        position: positionNum,
        bikeBrand: order.bikeBrand,
        bikeModel: order.bikeModel,
        customerName: order.sender.name,
        allocatedAt: new Date()
      });
    }

    // Update the order with new storage locations
    const updateOrder = async () => {
      try {
        // Convert Date objects to ISO strings for JSON storage
        const allocationsForDb = newAllocations.map(allocation => ({
          ...allocation,
          allocatedAt: allocation.allocatedAt.toISOString()
        }));

        const { error } = await supabase
          .from('orders')
          .update({ storage_locations: allocationsForDb })
          .eq('id', order.id);

        if (error) {
          console.error('Error updating storage locations:', error);
          toast.error('Failed to save storage allocation');
          return;
        }

        setAllAllocations(newAllocations);
        toast.success(`${bikeQuantity > 1 ? 'All bikes' : 'Bike'} allocated to storage`);
      } catch (error) {
        console.error('Error updating storage locations:', error);
        toast.error('Failed to save storage allocation');
      }
    };

    updateOrder();
  };

  const handleRemove = async () => {
    // Remove all allocations for this order
    const orderAllocations = allAllocations.filter(a => a.orderId === order.id);
    if (orderAllocations.length === 0) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ storage_locations: null })
        .eq('id', order.id);

      if (error) {
        console.error('Error removing storage locations:', error);
        toast.error('Failed to remove storage allocation');
        return;
      }

      setAllAllocations([]);
      
      // Reset form arrays
      const bikeQuantity = order.bikeQuantity || 1;
      setBays(Array(bikeQuantity).fill(''));
      setPositions(Array(bikeQuantity).fill(''));
      
      const isMultiple = orderAllocations.length > 1;
      toast.success(`${isMultiple ? 'All bikes' : 'Bike'} removed from storage`);
    } catch (error) {
      console.error('Error removing storage locations:', error);
      toast.error('Failed to remove storage allocation');
    }
  };

  // Check if order has been collected
  const hasBeenCollected = (order: Order) => {
    if (order.status === 'collected' || order.status === 'driver_to_delivery') {
      return true;
    }
    
    const trackingUpdates = order.trackingEvents?.shipday?.updates || [];
    return trackingUpdates.some(update => 
      update.description?.toLowerCase().includes('collected') || 
      update.description?.toLowerCase().includes('pickup') ||
      update.event === 'ORDER_POD_UPLOAD' ||
      update.status?.toLowerCase().includes('collected')
    );
  };

  // Only show storage location for collected bikes
  if (!hasBeenCollected(order)) {
    return null;
  }

  // Get all allocations for this order
  const orderAllocations = allAllocations.filter(a => a.orderId === order.id);
  const bikeQuantity = order.bikeQuantity || 1;
  const isMultiBike = bikeQuantity > 1;
  const hasAllocations = orderAllocations.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Storage Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasAllocations ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {isMultiBike ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Storage Locations:</div>
                  <div className="flex flex-wrap gap-1">
                    {orderAllocations
                      .sort((a, b) => {
                        if (a.bay !== b.bay) return a.bay.localeCompare(b.bay);
                        return a.position - b.position;
                      })
                      .map((allocation, index) => (
                        <Badge key={allocation.id} variant="secondary" className="font-mono text-sm px-2 py-1">
                          {allocation.bay}{allocation.position}
                        </Badge>
                      ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {orderAllocations.length} of {bikeQuantity} bikes allocated
                  </div>
                </div>
              ) : (
                <>
                  <Badge variant="secondary" className="font-mono text-lg px-3 py-1">
                    {orderAllocations[0].bay}{orderAllocations[0].position}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Stored: {orderAllocations[0].allocatedAt.toLocaleDateString()} at {orderAllocations[0].allocatedAt.toLocaleTimeString()}
                  </span>
                </>
              )}
            </div>
            
            {!isMultiBike && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Bay {orderAllocations[0].bay}, Position {orderAllocations[0].position}
                </span>
              </div>
            )}
            
            {isMultiBike && (
              <div className="text-sm text-muted-foreground">
                First bike stored: {orderAllocations[0].allocatedAt.toLocaleDateString()} at {orderAllocations[0].allocatedAt.toLocaleTimeString()}
              </div>
            )}
            
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleRemove}
            >
              Remove {isMultiBike ? 'All' : ''} from Storage
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              This bike has been collected but not yet allocated to storage.
              {isMultiBike && ` (${bikeQuantity} bikes need allocation)`}
            </div>
            
            {isMultiBike ? (
              <div className="space-y-4">
                <div className="text-sm font-medium">
                  {bikeQuantity} bikes total - {bikeQuantity} remaining to allocate
                </div>
                
                {Array.from({ length: bikeQuantity }, (_, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span className="font-medium">Bike {index + 1} of {bikeQuantity}</span>
                    </div>
                    
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <Label htmlFor={`bay-${index}`} className="text-sm">Bay (A-D)</Label>
                        <Input
                          id={`bay-${index}`}
                          value={bays[index] || ''}
                          onChange={(e) => {
                            const newBays = [...bays];
                            newBays[index] = e.target.value.toUpperCase();
                            setBays(newBays);
                          }}
                          placeholder="A"
                          maxLength={1}
                          className="text-center uppercase"
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor={`position-${index}`} className="text-sm">Position (1-15)</Label>
                        <Input
                          id={`position-${index}`}
                          value={positions[index] || ''}
                          onChange={(e) => {
                            const newPositions = [...positions];
                            newPositions[index] = e.target.value;
                            setPositions(newPositions);
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
                
                <Button 
                  onClick={handleAllocate}
                  disabled={bays.some(b => !b) || positions.some(p => !p)}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Allocate All {bikeQuantity} Bikes
                </Button>
              </div>
            ) : (
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label htmlFor="bay" className="text-sm">Bay (A-D)</Label>
                  <Input
                    id="bay"
                    value={bays[0] || ''}
                    onChange={(e) => setBays([e.target.value.toUpperCase()])}
                    placeholder="A"
                    maxLength={1}
                    className="text-center uppercase"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="position" className="text-sm">Position (1-15)</Label>
                  <Input
                    id="position"
                    value={positions[0] || ''}
                    onChange={(e) => setPositions([e.target.value])}
                    placeholder="1"
                    type="number"
                    min="1"
                    max="15"
                    className="text-center"
                  />
                </div>
                <Button 
                  onClick={handleAllocate}
                  disabled={!bays[0] || !positions[0]}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Allocate
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};