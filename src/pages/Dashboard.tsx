
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getOrders, resendSenderAvailabilityEmail } from "@/services/orderService";
import { Order } from "@/types/order";
import { toast } from "sonner";
import { format } from "date-fns";
import { Eye, RefreshCcw, Plus, Loader } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "@/components/StatusBadge";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    // Only fetch orders if authentication is complete and user is logged in
    if (!authLoading && user) {
      console.log("Dashboard - Fetching orders for user:", user.id);
      const fetchOrders = async () => {
        try {
          setIsOrdersLoading(true);
          const data = await getOrders();
          console.log("Dashboard - Orders fetched:", data.length);
          setOrders(data);
        } catch (error) {
          console.error("Error fetching orders:", error);
          toast.error("Failed to fetch orders");
        } finally {
          setIsOrdersLoading(false);
        }
      };

      fetchOrders();
    } else {
      console.log("Dashboard - Waiting for auth to complete:", { authLoading, user: !!user });
    }
  }, [authLoading, user]);

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

  // User authenticated but orders still loading
  if (!authLoading && user && isOrdersLoading) {
    return (
      <Layout>
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Your Orders</h1>
            <Button asChild>
              <Link to="/create-order">Create New Order</Link>
            </Button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden p-8 flex flex-col items-center justify-center">
            <Loader className="h-8 w-8 text-courier-600 animate-spin mb-4" />
            <p className="text-gray-600">Loading your orders...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Your Orders</h1>
          <Button asChild>
            <Link to="/create-order">
              <Plus className="h-4 w-4 mr-1" />
              Create New Order
            </Link>
          </Button>
        </div>

        {orders.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">No Orders Yet</h2>
            <p className="text-gray-600 mb-6">
              You haven't created any orders yet. Start by creating your first order.
            </p>
            <Button asChild>
              <Link to="/create-order">
                <Plus className="h-4 w-4 mr-1" />
                Create Your First Order
              </Link>
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Receiver</TableHead>
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
                    <TableCell>{format(new Date(order.createdAt), "PP")}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/orders/${order.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
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
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
