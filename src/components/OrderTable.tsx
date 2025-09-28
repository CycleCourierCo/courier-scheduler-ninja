
import React, { useState, useEffect, memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Eye, RefreshCcw, Bike, GripVertical, Calendar } from "lucide-react";
import { toast } from "sonner";
import { formatTimeslotWindow } from "@/utils/timeslotUtils";
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
  { id: "creator", label: "Created By" },
  { id: "trackingNumber", label: "Tracking Number" },
  { id: "status", label: "Status" },
  { id: "sender", label: "Sender" },
  { id: "receiver", label: "Receiver" },
  { id: "bike", label: "Bike" },
  { id: "pickupDate", label: "Pickup Date" },
  { id: "deliveryDate", label: "Delivery Date" },
  { id: "scheduledPickup", label: "Scheduled Pickup" },
  { id: "scheduledDelivery", label: "Scheduled Delivery" },
  { id: "created", label: "Created" },
  { id: "actions", label: "Actions" },
];

// Default visible columns if user has no saved preferences
const DEFAULT_VISIBLE_COLUMNS = [
  "trackingNumber", "status", "sender", "receiver", "bike", 
  "scheduledPickup", "scheduledDelivery", "created", "actions"
];

// Default column widths
const DEFAULT_COLUMN_WIDTHS = {
  creator: 15,
  trackingNumber: 12,
  status: 10,
  sender: 12,
  receiver: 12,
  bike: 12,
  pickupDate: 10,
  deliveryDate: 10,
  scheduledPickup: 10,
  scheduledDelivery: 10,
  created: 10,
  actions: 12,
};

const OrderTable: React.FC<OrderTableProps> = memo(({ orders, userRole }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);
  const [isResizing, setIsResizing] = useState(false);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});
  
  // Filter out actions column for non-admin users
  useEffect(() => {
    if (userRole !== "admin" && visibleColumns.includes("actions")) {
      setVisibleColumns(prevColumns => prevColumns.filter(col => col !== "actions"));
    }
  }, [userRole, visibleColumns]);

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

  // Fetch creator names for all orders - memoized to avoid unnecessary API calls
  useEffect(() => {
    const fetchCreatorNames = async () => {
      // Get unique user IDs from all orders
      const userIds = [...new Set(orders.map(order => order.user_id))];
      
      if (userIds.length === 0) return;
      
      // Check if we already have all the names we need
      setCreatorNames(current => {
        const missingUserIds = userIds.filter(id => !current[id]);
        if (missingUserIds.length === 0) return current;
        
        // Fetch missing user names asynchronously
        (async () => {
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('id, name, email')
              .in('id', missingUserIds);
            
            if (error) {
              console.error("Error fetching creator names:", error);
              return;
            }
            
            // Create a mapping of user ID to name, preserving existing names
            const nameMap: Record<string, string> = { ...current };
            data.forEach(profile => {
              nameMap[profile.id] = profile.name || profile.email || 'Unknown user';
            });
            
            setCreatorNames(nameMap);
          } catch (error) {
            console.error("Error fetching creator names:", error);
          }
        })();
        
        return current;
      });
    };
    
    fetchCreatorNames();
  }, [orders]);

  const handleColumnChange = (columns: string[]) => {
    // Filter out actions column for non-admin users
    const filteredColumns = userRole !== "admin" 
      ? columns.filter(col => col !== "actions") 
      : columns;
      
    setVisibleColumns(filteredColumns);
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

  const handleRowClick = (orderId: string) => {
    if (userRole === "admin") return; // Don't navigate on row click for admins
    navigate(`/customer-orders/${orderId}`);
  };

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

  useEffect(() => {
    // Add a handler to cancel resize if mouse is released outside of table
    if (isResizing) {
      const handleMouseUp = () => {
        setIsResizing(false);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = '';
      };
      
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  const startResize = (e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
    
    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    
    const startX = e.clientX;
    const startWidth = columnWidths[columnId];
    const tableWidth = e.currentTarget.closest('table')?.offsetWidth || 1000;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing) setIsResizing(true);
      
      const deltaX = moveEvent.clientX - startX;
      const percentageDelta = (deltaX / tableWidth) * 100;
      const newWidth = Math.max(5, startWidth + percentageDelta);
      
      // Update width of current column
      setColumnWidths(prev => ({
        ...prev,
        [columnId]: newWidth
      }));
    };
    
    const handleMouseUp = () => {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Save the new widths when resize is complete
      saveColumnWidths({
        ...columnWidths,
        [columnId]: columnWidths[columnId]
      });
      
      setIsResizing(false);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return "Not scheduled";
    const dateObj = new Date(date);
    // For date display, create a new date in UTC to avoid timezone conversion
    const utcDate = new Date(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());
    return format(utcDate, "PP");
  };

  // Determine cursor style for rows based on userRole
  const getRowClassName = () => {
    return userRole !== "admin" 
      ? "hover:bg-gray-50 dark:hover:bg-muted/40 cursor-pointer" 
      : "hover:bg-gray-50 dark:hover:bg-muted/40";
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden dark:bg-background">
      <div className="flex justify-end p-2 border-b">
        <TableColumnSettings 
          columns={userRole === "admin" ? ALL_COLUMNS : ALL_COLUMNS.filter(col => col.id !== "actions")} 
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
                  className="relative"
                  style={{ width: `${columnWidths[columnId]}%` }}
                >
                  <div className="flex items-center pr-6">
                    {ALL_COLUMNS.find(col => col.id === columnId)?.label}
                    <div 
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-700"
                      onMouseDown={(e) => startResize(e, columnId)}
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
              <TableRow 
                key={order.id} 
                className={getRowClassName()}
                onClick={() => handleRowClick(order.id)}
              >
                {visibleColumns.map((columnId) => (
                  <TableCell 
                    key={`${order.id}-${columnId}`}
                    style={{ width: `${columnWidths[columnId]}%` }}
                  >
                    {columnId === "creator" && (
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                        {creatorNames[order.user_id] || 'Unknown'}
                      </span>
                    )}
                    {columnId === "trackingNumber" && (
                      userRole === "admin" ? (
                        <Link 
                          to={`/orders/${order.id}`} 
                          className="hover:underline text-courier-600"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => {
                            // Prevent any potential side effects when opening in new tab
                            if (e.button === 1 || e.ctrlKey || e.metaKey) {
                              e.stopPropagation();
                            }
                          }}
                        >
                          {order.trackingNumber || `${order.id.substring(0, 8)}...`}
                        </Link>
                      ) : (
                        <span className="text-courier-600">
                          {order.trackingNumber || `${order.id.substring(0, 8)}...`}
                        </span>
                      )
                    )}
                    {columnId === "status" && <StatusBadge status={order.status} />}
                    {columnId === "sender" && order.sender.name}
                    {columnId === "receiver" && order.receiver.name}
                    {columnId === "bike" && (
                      <>
                        {order.bikeBrand && order.bikeModel ? (
                          <div className="flex items-center">
                            <Bike className="h-4 w-4 mr-1 text-gray-500" />
                            <span>
                              {order.bikeBrand} {order.bikeModel}
                              {order.bikeQuantity && order.bikeQuantity > 1 && (
                                <span className="text-xs text-gray-500 ml-1">
                                  (×{order.bikeQuantity})
                                </span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">Not specified</span>
                        )}
                      </>
                    )}
                    {columnId === "pickupDate" && (
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                        <span>{order.pickupDate ? formatDate(Array.isArray(order.pickupDate) ? order.pickupDate[0] : order.pickupDate) : "Not scheduled"}</span>
                      </div>
                    )}
                    {columnId === "deliveryDate" && (
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                        <span>{order.deliveryDate ? formatDate(Array.isArray(order.deliveryDate) ? order.deliveryDate[0] : order.deliveryDate) : "Not scheduled"}</span>
                      </div>
                    )}
                    {columnId === "scheduledPickup" && (
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                          <span>{formatDate(order.scheduledPickupDate)}</span>
                        </div>
                        {order.pickupTimeslot && (
                          <span className="text-xs text-muted-foreground ml-5">{formatTimeslotWindow(order.pickupTimeslot)}</span>
                        )}
                      </div>
                    )}
                    {columnId === "scheduledDelivery" && (
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                          <span>{formatDate(order.scheduledDeliveryDate)}</span>
                        </div>
                        {order.deliveryTimeslot && (
                          <span className="text-xs text-muted-foreground ml-5">{formatTimeslotWindow(order.deliveryTimeslot)}</span>
                        )}
                      </div>
                    )}
                    {columnId === "created" && format(new Date(order.createdAt), "PP")}
                    {columnId === "actions" && (
                      <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
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
});

export default OrderTable;
