
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Eye, RefreshCcw, Bike, GripVertical } from "lucide-react";
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

// Default column widths
const DEFAULT_COLUMN_WIDTHS = {
  id: 15,
  status: 15,
  sender: 15,
  receiver: 15,
  bike: 15,
  created: 15,
  actions: 20,
};

const OrderTable: React.FC<OrderTableProps> = ({ orders, userRole }) => {
  const { user } = useAuth();
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);
  
  useEffect(() => {
    // Load user preferences when component mounts
    const fetchUserPreferences = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error("Error fetching user preferences:", error);
          return;
        }
        
        // Using optional chaining and type assertion to safely access table_preferences
        const preferences = data?.table_preferences as any;
        if (preferences?.orders?.visibleColumns) {
          setVisibleColumns(preferences.orders.visibleColumns);
        }
        
        // Load column widths if saved
        if (preferences?.orders?.columnWidths) {
          setColumnWidths(preferences.orders.columnWidths);
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

  // Save column widths to user preferences
  const saveColumnWidths = async (newWidths: Record<string, number>) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error("Error fetching user preferences:", error);
        return;
      }
      
      // Get existing preferences
      const preferences = (data?.table_preferences as any) || {};
      
      // Update column widths
      const updatedPreferences = {
        ...preferences,
        orders: {
          ...preferences.orders,
          columnWidths: newWidths,
          visibleColumns: visibleColumns
        }
      };
      
      // Save updated preferences
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          table_preferences: updatedPreferences 
        } as any)
        .eq('id', user.id);
      
      if (updateError) {
        console.error("Error saving column preferences:", updateError);
      }
    } catch (error) {
      console.error("Error saving column preferences:", error);
    }
  };

  // Handle resize event for a column
  const handleResize = (columnId: string, newSize: number) => {
    const newWidths = { ...columnWidths, [columnId]: newSize };
    setColumnWidths(newWidths);
    saveColumnWidths(newWidths);
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
      <div className="overflow-x-auto">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              {visibleColumns.map((columnId) => (
                <TableHead 
                  key={columnId}
                  className="relative select-none"
                  style={{ width: `${columnWidths[columnId]}%` }}
                >
                  <div className="flex items-center justify-between p-2">
                    {ALL_COLUMNS.find(col => col.id === columnId)?.label}
                    <div 
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-700"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        
                        const startX = e.clientX;
                        const startWidth = columnWidths[columnId];
                        const tableWidth = e.currentTarget.closest('table')?.offsetWidth || 0;
                        
                        const onMouseMove = (moveEvent: MouseEvent) => {
                          const deltaX = moveEvent.clientX - startX;
                          const percentageDelta = (deltaX / tableWidth) * 100;
                          const newWidth = Math.max(5, startWidth + percentageDelta);
                          
                          setColumnWidths(prev => ({
                            ...prev,
                            [columnId]: newWidth
                          }));
                        };
                        
                        const onMouseUp = () => {
                          document.removeEventListener('mousemove', onMouseMove);
                          document.removeEventListener('mouseup', onMouseUp);
                          saveColumnWidths({
                            ...columnWidths,
                            [columnId]: columnWidths[columnId]
                          });
                        };
                        
                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                      }}
                    >
                      <GripVertical className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id} className="hover:bg-gray-50 dark:hover:bg-muted/40">
                {visibleColumns.map((columnId) => (
                  <TableCell 
                    key={`${order.id}-${columnId}`}
                    className="overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{ width: `${columnWidths[columnId]}%` }}
                  >
                    {columnId === "id" && (
                      <Link to={`/orders/${order.id}`} className="hover:underline text-courier-600">
                        {order.id.substring(0, 8)}...
                      </Link>
                    )}
                    {columnId === "status" && <StatusBadge status={order.status} />}
                    {columnId === "sender" && order.sender.name}
                    {columnId === "receiver" && order.receiver.name}
                    {columnId === "bike" && (
                      <>
                        {order.bikeBrand && order.bikeModel ? (
                          <div className="flex items-center">
                            <Bike className="h-4 w-4 mr-1 text-gray-500" />
                            <span>{order.bikeBrand} {order.bikeModel}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">Not specified</span>
                        )}
                      </>
                    )}
                    {columnId === "created" && format(new Date(order.createdAt), "PP")}
                    {columnId === "actions" && (
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
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default OrderTable;
