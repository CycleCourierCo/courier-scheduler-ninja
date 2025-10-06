import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Layout from "@/components/Layout";
import { Order } from "@/types/order";
import { mapDbOrderToOrderType } from "@/services/orderServiceUtils";
import { format } from "date-fns";
import { CalendarIcon, Package } from "lucide-react";

const BulkAvailabilityPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<(Order & { displayRole: 'sender' | 'receiver' })[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [dates, setDates] = useState<Date[]>([]);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPendingOrders();
  }, [user]);

  const fetchPendingOrders = async () => {
    if (!user?.email) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .neq("status", "delivered")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Map and filter orders, creating separate entries for sender and receiver roles
      const mappedOrders = data?.map(mapDbOrderToOrderType) || [];
      const expandedOrders: (Order & { displayRole: 'sender' | 'receiver' })[] = [];
      
      mappedOrders.forEach((order: Order) => {
        const senderEmail = order.sender?.email?.toLowerCase();
        const receiverEmail = order.receiver?.email?.toLowerCase();
        const userEmail = user.email?.toLowerCase();
        
        // Add as sender if email matches and not confirmed
        if (senderEmail === userEmail && !order.senderConfirmedAt) {
          expandedOrders.push({ ...order, displayRole: 'sender' });
        }
        
        // Add as receiver if email matches and not confirmed
        if (receiverEmail === userEmail && !order.receiverConfirmedAt) {
          expandedOrders.push({ ...order, displayRole: 'receiver' });
        }
      });

      setOrders(expandedOrders);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOrderSelection = (orderId: string, role: 'sender' | 'receiver') => {
    const key = `${orderId}-${role}`;
    setSelectedOrderIds((prev) =>
      prev.includes(key)
        ? prev.filter((id) => id !== key)
        : [...prev, key]
    );
  };

  const handleSubmit = async () => {
    console.log("handleSubmit called", { 
      selectedOrderIds: selectedOrderIds.length, 
      datesCount: dates.length,
      dates 
    });

    if (selectedOrderIds.length === 0) {
      toast.error("Please select at least one order");
      return;
    }

    if (dates.length === 0) {
      toast.error("Please select at least 7 dates");
      return;
    }

    if (dates.length < 7) {
      toast.error("Please select at least 7 dates");
      return;
    }

    try {
      setIsSubmitting(true);

      // Update each selected order
      console.log("Starting loop, selectedOrderIds:", selectedOrderIds);
      console.log("Available orders:", orders.map(o => ({ id: o.id, role: o.displayRole })));

      for (const selectedKey of selectedOrderIds) {
        console.log("Processing selectedKey:", selectedKey);
        // Split from the LAST hyphen since UUIDs contain hyphens
        const lastHyphenIndex = selectedKey.lastIndexOf('-');
        const orderId = selectedKey.substring(0, lastHyphenIndex);
        const role = selectedKey.substring(lastHyphenIndex + 1) as 'sender' | 'receiver';
        console.log("Split into orderId:", orderId, "role:", role);
        
        const order = orders.find((o) => o.id === orderId && o.displayRole === role);
        console.log("Found order:", order ? "Yes" : "No");
        
        if (!order) {
          console.log("Skipping - order not found");
          continue;
        }

        const isSender = role === 'sender';
        // Format dates as ISO strings for database
        const dateStrings = dates
          .map((date) => {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return d.toISOString();
          })
          .sort();

        console.log(`Updating order ${orderId} as ${role}`, { 
          dateStrings, 
          isSender,
          receiverConfirmedAt: order.receiverConfirmedAt
        });

        if (isSender) {
          // Determine status: if receiver already confirmed, move to scheduled_dates_pending
          const newStatus = order.receiverConfirmedAt 
            ? "scheduled_dates_pending" 
            : "receiver_availability_pending";

          console.log("About to update sender with:", {
            pickup_date: dateStrings,
            sender_notes: notes,
            status: newStatus,
            orderId
          });

          const { data, error } = await supabase
            .from("orders")
            .update({
              pickup_date: dateStrings,
              sender_notes: notes,
              sender_confirmed_at: new Date().toISOString(),
              status: newStatus,
            })
            .eq("id", orderId)
            .select();

          console.log("Sender update result:", { data, error });

          if (error) {
            console.error("Error updating sender availability:", error);
            throw error;
          }
        } else {
          // Receiver is always setting to scheduled_dates_pending since sender must confirm first
          console.log("About to update receiver with:", {
            delivery_date: dateStrings,
            receiver_notes: notes,
            orderId
          });

          const { data, error } = await supabase
            .from("orders")
            .update({
              delivery_date: dateStrings,
              receiver_notes: notes,
              receiver_confirmed_at: new Date().toISOString(),
              status: "scheduled_dates_pending",
            })
            .eq("id", orderId)
            .select();

          console.log("Receiver update result:", { data, error });

          if (error) {
            console.error("Error updating receiver availability:", error);
            throw error;
          }
        }
      }

      toast.success(`Successfully updated ${selectedOrderIds.length} order(s)`);
      setSelectedOrderIds([]);
      setDates([]);
      setNotes("");
      fetchPendingOrders();
    } catch (error: any) {
      console.error("Error updating availability:", error);
      toast.error("Failed to update availability");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today || date.getDay() === 5; // Disable past dates and Fridays
  };

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Bulk Availability Confirmation</h1>
          <p className="text-muted-foreground">
            Select multiple orders and provide your availability dates for all of them at once
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Orders Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Orders</CardTitle>
              <CardDescription>
                Choose the orders you want to confirm availability for
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading orders...</p>
              ) : orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No orders pending availability confirmation
                </p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {orders.map((order) => {
                    const key = `${order.id}-${order.displayRole}`;
                    const role = order.displayRole === 'sender' ? 'Sender' : 'Receiver';

                    return (
                      <div
                        key={key}
                        className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent transition-colors"
                      >
                        <Checkbox
                          id={key}
                          checked={selectedOrderIds.includes(key)}
                          onCheckedChange={() => toggleOrderSelection(order.id, order.displayRole)}
                        />
                        <label
                          htmlFor={key}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {order.bikeBrand && order.bikeModel 
                                ? `${order.bikeBrand} ${order.bikeModel}`
                                : order.customerOrderNumber || "No bike info"}
                            </span>
                            <span className="text-xs text-muted-foreground">({role})</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {order.sender?.name} → {order.receiver?.name}
                          </div>
                          {order.trackingNumber && (
                            <div className="text-xs text-muted-foreground">
                              Tracking: {order.trackingNumber}
                            </div>
                          )}
                          {order.customerOrderNumber && (
                            <div className="text-xs text-muted-foreground">
                              Order #{order.customerOrderNumber}
                            </div>
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Date Selection */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Your Available Dates</CardTitle>
                <CardDescription>
                  Choose at least 7 dates when you're available
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <Calendar
                    mode="multiple"
                    selected={dates}
                    onSelect={(selectedDates) => {
                      if (selectedDates) {
                        setDates(selectedDates);
                      }
                    }}
                    disabled={isDateDisabled}
                    className="rounded-md border pointer-events-auto"
                  />
                </div>
                {dates.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">
                      Selected dates ({dates.length}/7 minimum):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {dates.map((date, index) => (
                        <div
                          key={index}
                          className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                        >
                          {format(date, "MMM dd, yyyy")}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Additional Notes (Optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special instructions or notes..."
                  rows={4}
                />
              </CardContent>
            </Card>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedOrderIds.length === 0 || dates.length < 7}
              className="w-full"
              size="lg"
            >
              {isSubmitting
                ? "Updating..."
                : `Confirm Availability for ${selectedOrderIds.length} Order(s)`}
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default BulkAvailabilityPage;
