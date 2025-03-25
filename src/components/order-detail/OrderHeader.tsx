
import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { OrderStatus } from "@/types/order";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: "created", label: "Created" },
  { value: "sender_availability_pending", label: "Sender Confirmation Pending" },
  { value: "sender_availability_confirmed", label: "Sender Confirmed" },
  { value: "receiver_availability_pending", label: "Receiver Confirmation Pending" },
  { value: "receiver_availability_confirmed", label: "Receiver Confirmed" },
  { value: "scheduled_dates_pending", label: "Scheduled Dates Pending" },
  { value: "pending_approval", label: "Pending Approval (Legacy)" },
  { value: "scheduled", label: "Scheduled" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

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
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <Button variant="outline" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="mr-2" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Order Details</h1>
      </div>
      <div className="flex items-center space-x-3">
        <StatusBadge status={status} />
        <Select 
          value={selectedStatus || undefined} 
          onValueChange={(value) => onStatusChange(value as OrderStatus)}
          disabled={statusUpdating}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Change status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default OrderHeader;
