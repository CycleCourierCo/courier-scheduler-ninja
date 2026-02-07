
import React, { useEffect, useState, useMemo, useCallback, memo } from "react";
import { getOrdersWithFilters } from "@/services/orderService";
import { Order } from "@/types/order";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import OrderFilters from "@/components/OrderFilters";
import OrderListContainer from "@/components/OrderListContainer";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

const Dashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filters, setFilters] = useState({
    status: [],
    search: "",
    sortBy: "created_desc",
    dateFrom: undefined as Date | undefined,
    dateTo: undefined as Date | undefined,
    customerId: undefined as string | undefined
  });
  const { user } = useAuth();

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
    if (!user || userRole === null) {
      return;
    }
    
    try {
      const response = await getOrdersWithFilters({
        page: currentPage,
        pageSize: itemsPerPage,
        search: filters.search,
        status: filters.status.length > 0 ? filters.status : undefined,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        sortBy: filters.sortBy,
        userId: user.id,
        userRole: userRole,
        customerId: filters.customerId
      });
      
      setOrders(response.data);
      setTotalCount(response.count);
      setLoading(false);
    } catch (error) {
      console.error("Dashboard: Error fetching orders:", error);
      toast.error("Failed to fetch orders");
      setLoading(false);
    }
  }, [user, userRole, currentPage, itemsPerPage, filters]);

  // Fetch orders when dependencies change
  useEffect(() => {
    if (userRole !== null) {
      fetchOrders();
    }
  }, [fetchOrders, userRole]);

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = totalCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endIndex = Math.min(currentPage * itemsPerPage, totalCount);

  const handleFilterChange = useCallback((newFilters: {
    status: string[];
    search: string;
    sortBy: string;
    dateFrom: Date | undefined;
    dateTo: Date | undefined;
    customerId?: string | undefined;
  }) => {
    setFilters(newFilters as typeof filters);
    setCurrentPage(1); // Reset to first page when filters change
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ status: [], search: "", sortBy: "created_desc", dateFrom: undefined, dateTo: undefined, customerId: undefined });
    setCurrentPage(1);
  }, []);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  if (userRole === null) {
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
        <DashboardHeader 
          userRole={userRole}
        />
        
        <OrderFilters 
          onFilterChange={handleFilterChange} 
          initialFilters={filters}
          userRole={userRole}
        />

        <OrderListContainer
          orders={orders}
          userRole={userRole}
          totalCount={totalCount}
          loading={loading}
          onClearFilters={handleClearFilters}
        />

        {totalCount > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t pt-4 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex} to {endIndex} of {totalCount} orders
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
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
