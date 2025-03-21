
import React, { useState, useEffect } from "react";
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
import TableColumnSettings from "@/components/TableColumnSettings";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OrderTableProps {
  orders: Order[];
  userRole: string | null;
}

// Define all available columns
const ALL_COLUMNS = [
  { id: "id", label: "ID" },
  { id: "status", label: "Status" },
  { id: "sender", label: "Sender" },
  { id: "receiver", label: "Receiver" },
  { id: "bike", label: "Bike" },
  { id: "created", label: "Created" },
  { id: "actions", label: "Actions" },
];

// Default visible columns if user has no saved preferences
const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.map(col => col.id);

const OrderTable: React.FC<OrderTableProps> = ({ orders, userRole }) => {
  const { user } = useAuth();
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
  
  useEffect(() => {
    // Load user preferences when component mounts
    const fetchUserPreferences = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')  // Changed from specific column to all columns
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error("Error fetching user preferences:", error);
          return;
        }
        
        // Safely access table_preferences using optional chaining and type casting
        const preferences = (data as any).table_preferences;
        if (preferences?.orders?.visibleColumns) {
          setVisibleColumns(preferences.orders.visibleColumns);
        }
      } catch (error) {
        console.error("Error fetching user preferences:", error);
      }
    };
    
    fetchUserPreferences();
  }, [user]);

  const handleColumnChange = (columns: string[]) => {
    setVisibleColumns(columns);
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

  // Check if column should be visible
  const isColumnVisible = (columnId: string) => visibleColumns.includes(columnId);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden dark:bg-background">
      <div className="flex justify-end p-2 border-b">
        <TableColumnSettings 
          columns={ALL_COLUMNS} 
          visibleColumns={visibleColumns} 
          onChange={handleColumnChange} 
        />
      </div>
      <ResizablePanelGroup direction="horizontal" className="overflow-x-auto">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              {isColumnVisible("id") && (
                <TableHead className="w-[12%]">ID</TableHead>
              )}
              {isColumnVisible("status") && (
                <TableHead className="w-[12%]">Status</TableHead>
              )}
              {isColumnVisible("sender") && (
                <TableHead className="w-[12%]">Sender</TableHead>
              )}
              {isColumnVisible("receiver") && (
                <TableHead className="w-[12%]">Receiver</TableHead>
              )}
              {isColumnVisible("bike") && (
                <TableHead className="w-[16%]">Bike</TableHead>
              )}
              {isColumnVisible("created") && (
                <TableHead className="w-[12%]">Created</TableHead>
              )}
              {isColumnVisible("actions") && (
                <TableHead className="w-[24%]">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id} className="hover:bg-gray-50 dark:hover:bg-muted/40">
                {isColumnVisible("id") && (
                  <TableCell className="font-medium">
                    <Link to={`/orders/${order.id}`} className="hover:underline text-courier-600">
                      {order.id.substring(0, 8)}...
                    </Link>
                  </TableCell>
                )}
                {isColumnVisible("status") && (
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                )}
                {isColumnVisible("sender") && (
                  <TableCell>{order.sender.name}</TableCell>
                )}
                {isColumnVisible("receiver") && (
                  <TableCell>{order.receiver.name}</TableCell>
                )}
                {isColumnVisible("bike") && (
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
                )}
                {isColumnVisible("created") && (
                  <TableCell>{format(new Date(order.createdAt), "PP")}</TableCell>
                )}
                {isColumnVisible("actions") && (
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
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ResizablePanelGroup>
    </div>
  );
};

export default OrderTable;
