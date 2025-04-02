
import React from "react";
import { OrderStatus } from "@/types/order";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: OrderStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusConfig = (status: OrderStatus) => {
    switch (status) {
      case "created":
        return { label: "Created", className: "bg-gray-500" };
      case "sender_availability_pending":
        return { label: "Sender Confirmation Pending", className: "bg-yellow-500" };
      case "sender_availability_confirmed":
        return { label: "Sender Confirmed", className: "bg-blue-500" };
      case "receiver_availability_pending":
        return { label: "Receiver Confirmation Pending", className: "bg-yellow-500" };
      case "receiver_availability_confirmed":
        return { label: "Receiver Confirmed", className: "bg-blue-500" };
      case "scheduled_dates_pending":
      case "pending_approval": // Handle both values the same way
        return { label: "Scheduled Dates Pending", className: "bg-purple-300" };
      case "scheduled":
        return { label: "Scheduled", className: "bg-purple-500" };
      case "driver_to_collection":
        return { label: "Driver En Route to Pickup", className: "bg-blue-600" };
      case "collected":
        return { label: "Bike Collected", className: "bg-green-400" };
      case "driver_to_delivery":
        return { label: "Driver En Route to Delivery", className: "bg-blue-600" };
      case "shipped":
        return { label: "Shipped", className: "bg-courier-600" };
      case "delivered":
        return { label: "Delivered", className: "bg-green-500" };
      case "cancelled":
        return { label: "Cancelled", className: "bg-red-500" };
      default:
        return { label: status, className: "bg-gray-500" };
    }
  };

  const { label, className } = getStatusConfig(status);

  return (
    <Badge className={cn("text-white font-medium", className)}>
      {label}
    </Badge>
  );
};

export default StatusBadge;
