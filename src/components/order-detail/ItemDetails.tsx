
import React from "react";
import { Package, FileText, Wrench } from "lucide-react";
import { Order } from "@/types/order";

interface ItemDetailsProps {
  order: Order;
}

const ItemDetails: React.FC<ItemDetailsProps> = ({ order }) => {
  const quantity = order.bikeQuantity || 1;
  const isMultipleBikes = quantity > 1;
  const itemName = isMultipleBikes 
    ? `${quantity} bikes` 
    : `${order.bikeBrand || ""} ${order.bikeModel || ""}`.trim() || "Bike";

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Package className="text-courier-600" />
        <h3 className="font-semibold">Item Details</h3>
      </div>
      <div className="bg-gray-50 p-3 rounded-md">
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
      </div>
      
      {order.deliveryInstructions && (
        <div className="mt-4">
          <div className="flex items-center space-x-2 mb-2">
            <FileText className="text-courier-600" />
            <h3 className="font-semibold">Delivery Instructions</h3>
          </div>
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="whitespace-pre-line">{order.deliveryInstructions}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemDetails;
