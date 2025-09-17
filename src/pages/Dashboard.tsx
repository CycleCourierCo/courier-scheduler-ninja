
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

const Dashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filters, setFilters] = useState({
    status: [],
    search: "",
    sortBy: "created_desc"
  });
  const { user } = useAuth();
  const ordersRef = useRef<Order[]>([]);
  const isInitialLoad = useRef(true);

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

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    
    console.log("fetchOrders called - user:", user.id, "userRole:", userRole);
    
    try {
      setLoading(true);
      const data = await getOrders();
      
      let newOrders: Order[];
      // Only show all orders if the user is specifically an "admin"
      if (userRole === "admin") {
        newOrders = data;
      } else {
        const filteredOrders = data.filter(order => order.user_id === user.id);
        newOrders = filteredOrders;
      }
      
      // Only update orders if they have actually changed using a more stable comparison
      const orderIds = newOrders.map(o => o.id).sort().join(',');
      const currentOrderIds = ordersRef.current.map(o => o.id).sort().join(',');
      const statusMap = newOrders.map(o => `${o.id}:${o.status}`).sort().join(',');
      const currentStatusMap = ordersRef.current.map(o => `${o.id}:${o.status}`).sort().join(',');
      
      const ordersChanged = orderIds !== currentOrderIds || statusMap !== currentStatusMap;
      console.log("Orders changed:", ordersChanged, "isInitialLoad:", isInitialLoad.current);
      
      if (ordersChanged || isInitialLoad.current) {
        console.log("Updating orders state");
        ordersRef.current = newOrders;
        setOrders(newOrders);
        isInitialLoad.current = false;
      } else {
        console.log("Skipping orders update - no changes detected");
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  }, [user, userRole]);

  useEffect(() => {
    if (userRole !== null) {
      fetchOrders();
    }
  }, [fetchOrders]);

  // Add window focus listener to prevent unnecessary fetches when switching tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Only refetch if page becomes visible and we're not in the initial load
      if (!document.hidden && !isInitialLoad.current) {
        console.log("Page became visible, but skipping refetch to prevent unnecessary re-renders");
        // Optionally uncomment the line below if you want to refetch on focus
        // fetchOrders();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Apply filters when orders or filters change
  useEffect(() => {
    const result = applyFiltersToOrders(orders, filters);
    setFilteredOrders(result);
    
    // Validate current page is still valid after filtering
    const newTotalPages = Math.ceil(result.length / itemsPerPage);
    if (currentPage > newTotalPages && newTotalPages > 0) {
      setCurrentPage(newTotalPages);
    }
  }, [orders, filters, currentPage, itemsPerPage]);

  // Reset to first page only when filters change (not when orders update)
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Calculate pagination with stable reference
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, currentPage, itemsPerPage]);

  // Memoize userRole to prevent unnecessary re-renders
  const stableUserRole = useMemo(() => userRole, [userRole]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, filteredOrders.length);

  const handleFilterChange = (newFilters: {
    status: string[];
    search: string;
    sortBy: string;
  }) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({ status: [], search: "", sortBy: "created_desc" });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
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
          <div className="space-y-4">
            <OrderTable orders={paginatedOrders} userRole={stableUserRole} />
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex} to {endIndex} of {filteredOrders.length} orders
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page:</span>
                  <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      // Show first page, last page, current page, and pages around current page
                      return page === 1 || 
                             page === totalPages || 
                             (page >= currentPage - 1 && page <= currentPage + 1);
                    })
                    .map((page, index, array) => {
                      // Add ellipsis if there's a gap
                      const prevPage = array[index - 1];
                      const showEllipsis = prevPage && page - prevPage > 1;
                      
                      return (
                        <div key={page} className="flex items-center">
                          {showEllipsis && (
                            <span className="px-2 text-muted-foreground">...</span>
                          )}
                          <Button
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        </div>
                      );
                    })
                  }
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
