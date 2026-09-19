
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
        return { label: "Created", variant: "neutral" as const };
      case "sender_availability_pending":
        return { label: "Sender Confirmation Pending", variant: "waiting" as const };
      case "sender_availability_confirmed":
        return { label: "Sender Confirmed", variant: "booked" as const };
      case "receiver_availability_pending":
        return { label: "Receiver Confirmation Pending", variant: "waiting" as const };
      case "receiver_availability_confirmed":
        return { label: "Receiver Confirmed", variant: "booked" as const };
      case "scheduled_dates_pending":
      case "pending_approval":
        return { label: "Scheduled Dates Pending", variant: "waiting" as const };
      case "scheduled":
        return { label: "Scheduled", variant: "booked" as const };
      case "collection_scheduled":
        return { label: "Collection Scheduled", variant: "booked" as const };
      case "delivery_scheduled":
        return { label: "Delivery Scheduled", variant: "booked" as const };
      case "driver_to_collection":
        return { label: "Driver En Route to Pickup", variant: "transit" as const };
      case "collected":
        return { label: "Bike Collected", variant: "done" as const };
      case "driver_to_delivery":
        return { label: "Driver En Route to Delivery", variant: "transit" as const };
      case "shipped":
        return { label: "Shipped", variant: "neutral" as const };
      case "delivered":
        return { label: "Delivered", variant: "done" as const };
      case "cancelled":
        return { label: "Cancelled", variant: "failed" as const };
      case "awaiting_depot":
        return { label: "Awaiting delivery to depot", variant: "waiting" as const };
      case "in_depot_awaiting_boxing":
        return { label: "In depot, awaiting boxing", variant: "inspection" as const };
      case "boxed_awaiting_label":
        return { label: "Boxed, awaiting label", variant: "ni" as const };
      case "awaiting_3p_collection":
        return { label: "Awaiting 3rd-party collection", variant: "waiting" as const };
      case "collected_by_3p":
        return { label: "Collected by 3rd-party courier", variant: "done" as const };
      case "delivered_by_3p":
        return { label: "Delivered by 3rd-party courier", variant: "done" as const };
      case "delivered_to_ferry":
        return { label: "Delivered to ferry — awaiting transport across the Irish Sea", variant: "ni" as const };
      case "awaiting_trunk_to_scotland":
        return { label: "At depot — awaiting transport to Scotland", variant: "waiting" as const };
      case "in_transit_to_scotland":
        return { label: "In transit to our Scotland depot", variant: "trunk" as const };
      case "at_scotland_depot":
        return { label: "At our Scotland depot", variant: "trunk" as const };
      case "awaiting_trunk_to_depot":
        return { label: "At Scotland depot — awaiting transport south", variant: "waiting" as const };
      case "in_transit_to_depot":
        return { label: "In transit to our main depot", variant: "trunk" as const };

      default:
        return { label: status, variant: "neutral" as const };
    }
  };

  const { label, variant } = getStatusConfig(status);

  return (
    <Badge variant={variant} className={cn("font-semibold")}>
      {label}
    </Badge>
  );
};

export default StatusBadge;
