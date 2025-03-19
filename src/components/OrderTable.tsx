
import React from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Eye, RefreshCcw, Bike } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { Order } from "@/types/order";
import { resendSenderAvailabilityEmail } from "@/services/orderService";

interface OrderTableProps {
  orders: Order[];
  userRole: string | null;
}

const OrderTable: React.FC<OrderTableProps> = ({ orders, userRole }) => {
  const handleResendEmail = async (orderId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const success = await resendSenderAvailabilityEmail(orderId);
      if (success) {
        toast.success("Email resent successfully");
      }
    } catch (error) {
      console.error("Error resending email:", error);
      toast.error("Failed to resend email");
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sender</TableHead>
              <TableHead>Receiver</TableHead>
              <TableHead>Bike</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id} className="hover:bg-gray-50">
                <TableCell className="font-medium">
                  <Link to={`/orders/${order.id}`} className="hover:underline text-courier-600">
                    {order.id.substring(0, 8)}...
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell>{order.sender.name}</TableCell>
                <TableCell>{order.receiver.name}</TableCell>
                <TableCell>
                  {order.bikeBrand && order.bikeModel ? (
                    <div className="flex items-center">
                      <Bike className="h-4 w-4 mr-1 text-gray-500" />
                      <span>{order.bikeBrand} {order.bikeModel}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400">Not specified</span>
                  )}
                </TableCell>
                <TableCell>{format(new Date(order.createdAt), "PP")}</TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    {userRole === "admin" && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/orders/${order.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          Admin
                        </Link>
                      </Button>
                    )}
                    
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/customer-orders/${order.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        Customer
                      </Link>
                    </Button>
                    
                    {order.status === "sender_availability_pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleResendEmail(order.id, e)}
                      >
                        <RefreshCcw className="h-4 w-4 mr-1" />
                        Resend
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default OrderTable;
