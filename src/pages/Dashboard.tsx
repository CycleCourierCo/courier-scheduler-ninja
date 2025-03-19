
import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { getOrders, resendSenderAvailabilityEmail } from "@/services/orderService";
import { Order, OrderStatus } from "@/types/order";
import { toast } from "sonner";
import { format } from "date-fns";
import { Eye, RefreshCcw, Bike } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import OrderFilters from "@/components/OrderFilters";

const Dashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: "all",
    search: "",
    sortBy: "created_desc"
  });
  const { user } = useAuth();

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        setUserRole(data?.role || null);
      } catch (error) {
        console.error("Error fetching user role:", error);
        toast.error("Failed to fetch user role");
      }
    };

    fetchUserRole();
  }, [user]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const data = await getOrders();
        
        // Only show all orders if the user is specifically an "admin"
        if (userRole === "admin") {
          console.log("User is admin, showing all orders");
          setOrders(data);
        } else {
          console.log("User is not admin, filtering orders for user ID:", user.id);
          const filteredOrders = data.filter(order => order.user_id === user.id);
          console.log("Filtered orders:", filteredOrders.length);
          setOrders(filteredOrders);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
        toast.error("Failed to fetch orders");
      } finally {
        setLoading(false);
      }
    };

    if (userRole !== null) {
      fetchOrders();
    }
  }, [user, userRole]);

  // Apply filters and sorting to orders
  useEffect(() => {
    let result = [...orders];
    
    // Apply status filter
    if (filters.status !== "all") {
      result = result.filter(order => order.status === filters.status);
    }
    
    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(order => 
        order.sender.name.toLowerCase().includes(searchLower) ||
        order.receiver.name.toLowerCase().includes(searchLower) ||
        order.id.toLowerCase().includes(searchLower) ||
        (order.bikeBrand && order.bikeBrand.toLowerCase().includes(searchLower)) ||
        (order.bikeModel && order.bikeModel.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply sorting
    result = sortOrders(result, filters.sortBy);
    
    setFilteredOrders(result);
  }, [orders, filters]);

  const sortOrders = (ordersToSort: Order[], sortBy: string) => {
    const sortedOrders = [...ordersToSort];
    
    switch (sortBy) {
      case "created_asc":
        return sortedOrders.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      case "created_desc":
        return sortedOrders.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case "sender_name":
        return sortedOrders.sort((a, b) => 
          a.sender.name.localeCompare(b.sender.name)
        );
      case "receiver_name":
        return sortedOrders.sort((a, b) => 
          a.receiver.name.localeCompare(b.receiver.name)
        );
      default:
        return sortedOrders;
    }
  };

  const handleFilterChange = (newFilters: {
    status: string;
    search: string;
    sortBy: string;
  }) => {
    setFilters(newFilters);
  };

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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-courier-600"></div>
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
            <Link to="/create-order">Create New Order</Link>
          </Button>
        </div>

        <OrderFilters onFilterChange={handleFilterChange} />

        {filteredOrders.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">No Orders Found</h2>
            <p className="text-gray-600 mb-6">
              {orders.length === 0 
                ? "You haven't created any orders yet. Start by creating your first order."
                : "No orders match your current filters. Try adjusting your search or filter settings."}
            </p>
            {orders.length === 0 ? (
              <Button asChild>
                <Link to="/create-order">Create Your First Order</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setFilters({ status: "all", search: "", sortBy: "created_desc" })}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
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
                  {filteredOrders.map((order) => (
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
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
