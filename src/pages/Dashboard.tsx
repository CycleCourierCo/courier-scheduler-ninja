
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
    sortBy: "created_desc",
    dateFrom: undefined as Date | undefined,
    dateTo: undefined as Date | undefined
  });
  const { user } = useAuth();
  const ordersRef = useRef<Order[]>([]);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        console.log("Dashboard: No user found");
        return;
      }
      
      console.log("Dashboard: Current user:", user.id, user.email);
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        console.log("Dashboard: User role:", data?.role);
        setUserRole(data?.role || null);
      } catch (error) {
        console.error("Dashboard: Failed to fetch user role:", error);
        toast.error("Failed to fetch user role");
      }
    };

    fetchUserRole();
  }, [user]);

  const fetchOrders = useCallback(async () => {
    if (!user) {
      console.log("Dashboard: No user for fetchOrders");
      return;
    }
    
    console.log("Dashboard: Fetching orders for user role:", userRole);
    
    try {
      setLoading(true);
      const data = await getOrders();
      console.log("Dashboard: Fetched", data.length, "orders from getOrders()");
      
      let newOrders: Order[];
      // Show all orders for admin and route_planner, only own orders for others
      if (userRole === "admin" || userRole === "route_planner") {
        console.log("Dashboard: User has access to all orders, showing all");
        newOrders = data;
      } else {
        console.log("Dashboard: User filtering to own orders");
        const filteredOrders = data.filter(order => order.user_id === user.id);
        console.log("Dashboard: Filtered to", filteredOrders.length, "orders");
        newOrders = filteredOrders;
      }
      
      
      ordersRef.current = newOrders;
      setOrders(newOrders);
      isInitialLoad.current = false;
    } catch (error) {
      console.error("Dashboard: Error fetching orders:", error);
      toast.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  }, [user, userRole]); // Add userRole dependency to get latest value

  // Fetch orders ONLY when userRole is determined for the first time
  useEffect(() => {
    if (userRole !== null && isInitialLoad.current) {
      fetchOrders();
    }
  }, [userRole]); // Only depend on userRole changing from null to a value

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
    dateFrom: Date | undefined;
    dateTo: Date | undefined;
  }) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({ status: [], search: "", sortBy: "created_desc", dateFrom: undefined, dateTo: undefined });
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
      <div className="container mx-auto px-4 py-6 space-y-8">
        <DashboardHeader />
        
        <OrderFilters 
          onFilterChange={handleFilterChange} 
          initialFilters={filters}
        />

        {filteredOrders.length === 0 ? (
          <EmptyOrdersState 
            hasOrders={orders.length > 0}
            onClearFilters={handleClearFilters} 
          />
        ) : (
          <div className="space-y-4">
            <OrderTable orders={paginatedOrders} userRole={stableUserRole} />
            
            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t pt-4 gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
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
              
              <div className="flex items-center gap-2 overflow-x-auto">
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
