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
import { format } from "date-fns";
import { CalendarIcon, Package } from "lucide-react";

const BulkAvailabilityPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
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

      // Filter orders where user's email matches sender or receiver
      // AND availability hasn't been set yet for their role
      const filteredOrders = data?.filter((order: any) => {
        const senderEmail = order.sender?.email?.toLowerCase();
        const receiverEmail = order.receiver?.email?.toLowerCase();
        const userEmail = user.email?.toLowerCase();
        
        // Check if user is sender or receiver
        const isSender = senderEmail === userEmail;
        const isReceiver = receiverEmail === userEmail;
        
        // Only show orders where user is involved AND hasn't confirmed availability yet
        if (isSender && !order.sender_confirmed_at) return true;
        if (isReceiver && !order.receiver_confirmed_at) return true;
        
        return false;
      }) || [];

      setOrders(filteredOrders as unknown as Order[]);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleSubmit = async () => {
    if (selectedOrderIds.length === 0) {
      toast.error("Please select at least one order");
      return;
    }

    if (dates.length === 0) {
      toast.error("Please select at least one date");
      return;
    }

    if (dates.length > 7) {
      toast.error("Please select no more than 7 dates");
      return;
    }

    try {
      setIsSubmitting(true);

      // Update each selected order
      for (const orderId of selectedOrderIds) {
        const order = orders.find((o) => o.id === orderId);
        if (!order) continue;

        const userEmail = user?.email?.toLowerCase();
        const senderEmail = order.sender?.email?.toLowerCase();
        const isSender = senderEmail === userEmail;

        const dateStrings = dates.map((date) => date.toISOString());

        if (isSender) {
          const { error } = await supabase
            .from("orders")
            .update({
              pickup_date: dateStrings,
              sender_notes: notes,
              sender_confirmed_at: new Date().toISOString(),
              status: "receiver_availability_pending",
            })
            .eq("id", orderId);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("orders")
            .update({
              delivery_date: dateStrings,
              receiver_notes: notes,
              receiver_confirmed_at: new Date().toISOString(),
              status: "scheduled_dates_pending",
            })
            .eq("id", orderId);

          if (error) throw error;
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
                    const userEmail = user?.email?.toLowerCase();
                    const senderEmail = order.sender?.email?.toLowerCase();
                    const isSender = senderEmail === userEmail;
                    const role = isSender ? "Sender" : "Receiver";

                    return (
                      <div
                        key={order.id}
                        className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent transition-colors"
                      >
                        <Checkbox
                          id={order.id}
                          checked={selectedOrderIds.includes(order.id)}
                          onCheckedChange={() => toggleOrderSelection(order.id)}
                        />
                        <label
                          htmlFor={order.id}
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
                  Choose up to 7 dates when you're available
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <Calendar
                    mode="multiple"
                    selected={dates}
                    onSelect={(selectedDates) => {
                      if (selectedDates && selectedDates.length <= 7) {
                        setDates(selectedDates);
                      } else if (selectedDates && selectedDates.length > 7) {
                        toast.error("You can select a maximum of 7 dates");
                      }
                    }}
                    disabled={isDateDisabled}
                    className="rounded-md border pointer-events-auto"
                  />
                </div>
                {dates.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">
                      Selected dates ({dates.length}/7):
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
              disabled={isSubmitting || selectedOrderIds.length === 0 || dates.length === 0}
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
