
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getOrders, resendSenderAvailabilityEmail } from "@/services/orderService";
import { Order } from "@/types/order";
import { toast } from "sonner";
import { format } from "date-fns";
import { Eye, RefreshCcw, ShieldAlert } from "lucide-react";
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
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

const Dashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userRole, user } = useAuth();

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) {
        // Don't fetch orders if user is not authenticated
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        const data = await getOrders();
        setOrders(data);
      } catch (error) {
        console.error("Error fetching orders:", error);
        setError("Failed to load orders. Please try refreshing the page.");
        toast.error("Failed to fetch orders");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

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

  if (error) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
            <p>{error}</p>
          </div>
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
      </Layout>
    );
  }

  const isAdmin = userRole === 'admin';

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">Your Orders</h1>
            {isAdmin && (
              <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full flex items-center">
                <ShieldAlert className="h-4 w-4 mr-1" />
                Admin
              </div>
            )}
          </div>
          <Button asChild>
            <Link to="/create-order">Create New Order</Link>
          </Button>
        </div>

        {loading ? (
          // Skeleton loader
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">No Orders Yet</h2>
            <p className="text-gray-600 mb-6">
              You haven't created any orders yet. Start by creating your first order.
            </p>
            <Button asChild>
              <Link to="/create-order">Create Your First Order</Link>
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
                        
                        {isAdmin && order.status === "sender_availability_pending" && (
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
