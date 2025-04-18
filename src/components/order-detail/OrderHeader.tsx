import React from "react";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { OrderStatus } from "@/types/order";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OrderHeaderProps {
  status: OrderStatus;
  statusUpdating: boolean;
  selectedStatus: OrderStatus | null;
  onStatusChange: (status: OrderStatus) => void;
}

const OrderHeader: React.FC<OrderHeaderProps> = ({
  status,
  statusUpdating,
  selectedStatus,
  onStatusChange,
}) => {
  const statusOptions: { value: OrderStatus; label: string }[] = [
    { value: "created", label: "Created" },
    { value: "sender_availability_pending", label: "Sender Availability Pending" },
    { value: "sender_availability_confirmed", label: "Sender Availability Confirmed" },
    { value: "receiver_availability_pending", label: "Receiver Availability Pending" },
    { value: "receiver_availability_confirmed", label: "Receiver Availability Confirmed" },
    { value: "scheduled_dates_pending", label: "Scheduled Dates Pending" },
    { value: "collection_scheduled", label: "Collection Scheduled" },
    { value: "delivery_scheduled", label: "Delivery Scheduled" },
    { value: "scheduled", label: "Scheduled" },
    { value: "driver_to_collection", label: "Driver to Collection" },
    { value: "collected", label: "Collected" },
    { value: "driver_to_delivery", label: "Driver to Delivery" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center">
        <h1 className="text-2xl font-bold">Order Details</h1>
        <ChevronRight className="mx-1 h-5 w-5 text-gray-500" />
        <StatusBadge status={status} />
      </div>

      <div className="mt-4 md:mt-0 w-full md:w-auto flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 items-center">
          <Select
            value={selectedStatus || status}
            onValueChange={(newStatus) => onStatusChange(newStatus as OrderStatus)}
            disabled={statusUpdating}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {statusUpdating && (
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-courier-600"></div>
          )}
        </div>
        
        {status === 'scheduled' && (
          <Button variant="outline" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Mark as Dispatched
          </Button>
        )}
      </div>
    </div>
  );
};

export default OrderHeader;
