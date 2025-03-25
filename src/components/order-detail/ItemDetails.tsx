
import React from "react";
import { Package, FileText } from "lucide-react";
import { Order } from "@/types/order";

interface ItemDetailsProps {
  order: Order;
}

const ItemDetails: React.FC<ItemDetailsProps> = ({ order }) => {
  const itemName = `${order.bikeBrand || ""} ${order.bikeModel || ""}`.trim() || "Bike";

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Package className="text-courier-600" />
        <h3 className="font-semibold">Item Details</h3>
      </div>
      <div className="bg-gray-50 p-3 rounded-md">
        <p><span className="font-medium">Item:</span> {itemName}</p>
        <p><span className="font-medium">Quantity:</span> 1</p>
        {order.customerOrderNumber && (
          <p><span className="font-medium">Order #:</span> {order.customerOrderNumber}</p>
        )}
        {order.isBikeSwap && (
          <p className="text-courier-600 font-medium mt-2">This is a bike swap</p>
        )}
        {order.needsPaymentOnCollection && (
          <p className="text-courier-600 font-medium">Payment required on collection</p>
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
