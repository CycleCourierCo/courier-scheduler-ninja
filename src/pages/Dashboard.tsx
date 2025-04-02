
import React, { useEffect, useState } from "react";
import { getOrders } from "@/services/orderService";
import { Order } from "@/types/order";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import OrderFilters from "@/components/OrderFilters";
import OrderTable from "@/components/OrderTable";
import EmptyOrdersState from "@/components/EmptyOrdersState";
import DashboardHeader from "@/components/DashboardHeader";
import { applyFiltersToOrders } from "@/utils/dashboardUtils";

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

  useEffect(() => {
    if (userRole !== null) {
      fetchOrders();
    }
  }, [user, userRole]);

  useEffect(() => {
    const result = applyFiltersToOrders(orders, filters);
    setFilteredOrders(result);
  }, [orders, filters]);

  const handleFilterChange = (newFilters: {
    status: string;
    search: string;
    sortBy: string;
  }) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({ status: "all", search: "", sortBy: "created_desc" });
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
        <DashboardHeader showActionButtons={true} userRole={userRole} />
        
        <div className="flex justify-between items-center">
          <OrderFilters 
            onFilterChange={handleFilterChange} 
            initialFilters={filters}
          />
        </div>

        {filteredOrders.length === 0 ? (
          <EmptyOrdersState 
            hasOrders={orders.length > 0}
            onClearFilters={handleClearFilters} 
          />
        ) : (
          <OrderTable orders={filteredOrders} userRole={userRole} />
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
