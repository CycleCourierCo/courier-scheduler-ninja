import React, { useState } from "react";
import { Package, FileText, Wrench } from "lucide-react";
import { Order } from "@/types/order";
import { Button } from "@/components/ui/button";
import { enableInspectionForOrder } from "@/services/inspectionService";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface ItemDetailsProps {
  order: Order;
  onRefresh?: () => Promise<void>;
}

const ItemDetails: React.FC<ItemDetailsProps> = ({ order, onRefresh }) => {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const [isEnablingInspection, setIsEnablingInspection] = useState(false);

  const quantity = order.bikeQuantity || 1;
  const isMultipleBikes = quantity > 1;
  const itemName = isMultipleBikes 
    ? `${quantity} bikes` 
    : `${order.bikeBrand || ""} ${order.bikeModel || ""}`.trim() || "Bike";

  const handleEnableInspection = async () => {
    if (!order.id) return;
    
    try {
      setIsEnablingInspection(true);
      await enableInspectionForOrder(order.id);
      if (onRefresh) {
        await onRefresh();
      }
      toast.success("Inspection enabled for this order");
    } catch (error) {
      console.error("Error enabling inspection:", error);
      toast.error("Failed to enable inspection");
    } finally {
      setIsEnablingInspection(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Package className="text-courier-600" />
        <h3 className="font-semibold">Item Details</h3>
      </div>
      <div className="bg-muted p-3 rounded-md">
        <p><span className="font-medium">Item:</span> {itemName}</p>
        <p><span className="font-medium">Quantity:</span> {quantity}</p>
        {order.customerOrderNumber && (
          <p><span className="font-medium">Order #:</span> {order.customerOrderNumber}</p>
        )}
        {order.isBikeSwap && (
          <p className="text-courier-600 font-medium mt-2">This is a bike swap</p>
        )}
        {order.needsPaymentOnCollection && (
          <p className="text-courier-600 font-medium">Payment required on collection</p>
        )}
        {order.needsInspection && (
          <div className="flex items-center gap-2 text-amber-600 font-medium mt-2">
            <Wrench className="h-4 w-4" />
            Bike will be inspected and serviced
          </div>
        )}
        {isAdmin && !order.needsInspection && (
          <Button
            onClick={handleEnableInspection}
            disabled={isEnablingInspection}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 mt-3"
          >
            <Wrench className="h-4 w-4" />
            {isEnablingInspection ? "Enabling..." : "Inspect and Service"}
          </Button>
        )}
      </div>
      
      {order.deliveryInstructions && (
        <div className="mt-4">
          <div className="flex items-center space-x-2 mb-2">
            <FileText className="text-courier-600" />
            <h3 className="font-semibold">Delivery Instructions</h3>
          </div>
          <div className="bg-muted p-3 rounded-md">
            <p className="whitespace-pre-line">{order.deliveryInstructions}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemDetails;
