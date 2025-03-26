import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Package } from "lucide-react";
import { format } from "date-fns";
import { getOrderById, updateOrderSchedule, updateAdminOrderStatus, resendSenderAvailabilityEmail, resendReceiverAvailabilityEmail } from "@/services/orderService";
import { createShipdayOrder } from "@/services/shipdayService";
import { Order, OrderStatus } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Layout from "@/components/Layout";
import { toast } from "sonner";

// Import our new components
import OrderHeader from "@/components/order-detail/OrderHeader";
import DateSelection from "@/components/order-detail/DateSelection";
import TrackingTimeline from "@/components/order-detail/TrackingTimeline";
import ItemDetails from "@/components/order-detail/ItemDetails";
import ContactDetails from "@/components/order-detail/ContactDetails";
import SchedulingButtons from "@/components/order-detail/SchedulingButtons";
import EmailResendButtons from "@/components/order-detail/EmailResendButtons";

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPickupDate, setSelectedPickupDate] = useState<string | null>(null);
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<string | null>(null);
  const [pickupTime, setPickupTime] = useState<string>("09:00");
  const [deliveryTime, setDeliveryTime] = useState<string>("12:00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingShipments, setIsCreatingShipments] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState<{sender: boolean; receiver: boolean}>({ sender: false, receiver: false });
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | null>(null);
  
  const [pickupDatePicker, setPickupDatePicker] = useState<Date | undefined>(undefined);
  const [deliveryDatePicker, setDeliveryDatePicker] = useState<Date | undefined>(undefined);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const fetchedOrder = await getOrderById(id);
        
        if (fetchedOrder) {
          setOrder(fetchedOrder);
          setSelectedStatus(fetchedOrder.status);
          
          if (fetchedOrder.scheduledPickupDate) {
            setSelectedPickupDate(new Date(fetchedOrder.scheduledPickupDate).toISOString());
            setPickupDatePicker(new Date(fetchedOrder.scheduledPickupDate));
          }
          
          if (fetchedOrder.scheduledDeliveryDate) {
            setSelectedDeliveryDate(new Date(fetchedOrder.scheduledDeliveryDate).toISOString());
            setDeliveryDatePicker(new Date(fetchedOrder.scheduledDeliveryDate));
          }
        } else {
          setError("Order not found");
        }
      } catch (err) {
        console.error("Error fetching order:", err);
        setError("Failed to load order details");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [id]);

  const handleScheduleOrder = async () => {
    if (!id || !selectedPickupDate || !selectedDeliveryDate) {
      toast.error("Please select both pickup and delivery dates");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const pickupDateTime = new Date(selectedPickupDate);
      const [pickupHours, pickupMinutes] = pickupTime.split(':').map(Number);
      pickupDateTime.setHours(pickupHours, pickupMinutes, 0);
      
      const deliveryDateTime = new Date(selectedDeliveryDate);
      const [deliveryHours, deliveryMinutes] = deliveryTime.split(':').map(Number);
      deliveryDateTime.setHours(deliveryHours, deliveryMinutes, 0);
      
      const updatedOrder = await updateOrderSchedule(
        id, 
        pickupDateTime, 
        deliveryDateTime
      );
      
      if (!updatedOrder) {
        throw new Error("Failed to update order schedule");
      }
      
      setOrder(updatedOrder);
      toast.success("Order has been scheduled successfully");
    } catch (error) {
      console.error("Error scheduling order:", error);
      toast.error(`Failed to schedule order: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateShipments = async () => {
    if (!id) {
      toast.error("Order ID is missing");
      return;
    }

    if (!order?.scheduledPickupDate || !order?.scheduledDeliveryDate) {
      toast.error("Order must be scheduled before creating shipments");
      return;
    }

    try {
      setIsCreatingShipments(true);
      
      const shipdayResponse = await createShipdayOrder(id);
      
      if (shipdayResponse) {
        const updatedOrder = await getOrderById(id);
        if (updatedOrder) {
          setOrder(updatedOrder);
        }
        
        toast.success("Shipments created successfully");
      } else {
        toast.error("Failed to create shipments");
      }
    } catch (error) {
      console.error("Error creating shipments:", error);
      toast.error(`Failed to create shipments: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsCreatingShipments(false);
    }
  };

  const handleAdminScheduleOrder = async () => {
    if (!id || !pickupDatePicker || !deliveryDatePicker) {
      toast.error("Please select both pickup and delivery dates");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const pickupDateTime = new Date(pickupDatePicker);
      const [pickupHours, pickupMinutes] = pickupTime.split(':').map(Number);
      pickupDateTime.setHours(pickupHours, pickupMinutes, 0);
      
      const deliveryDateTime = new Date(deliveryDatePicker);
      const [deliveryHours, deliveryMinutes] = deliveryTime.split(':').map(Number);
      deliveryDateTime.setHours(deliveryHours, deliveryMinutes, 0);
      
      const updatedOrder = await updateOrderSchedule(
        id, 
        pickupDateTime, 
        deliveryDateTime
      );
      
      if (!updatedOrder) {
        throw new Error("Failed to update order schedule");
      }
      
      setOrder(updatedOrder);
      toast.success("Order has been scheduled successfully");
    } catch (error) {
      console.error("Error scheduling order:", error);
      toast.error(`Failed to schedule order: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!id || !newStatus || newStatus === order?.status) return;
    
    try {
      setStatusUpdating(true);
      const updatedOrder = await updateAdminOrderStatus(id, newStatus);
      
      if (updatedOrder) {
        setOrder(updatedOrder);
        setSelectedStatus(updatedOrder.status);
        toast.success(`Status updated to ${newStatus}`);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(`Failed to update status: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleResendSenderEmail = async () => {
    if (!id) return;
    
    try {
      setIsResendingEmail(prev => ({ ...prev, sender: true }));
      const success = await resendSenderAvailabilityEmail(id);
      
      if (success) {
        toast.success("Email resent to sender successfully");
      } else {
        toast.error("Failed to resend email to sender");
      }
    } catch (error) {
      console.error("Error resending sender email:", error);
      toast.error(`Failed to resend email: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsResendingEmail(prev => ({ ...prev, sender: false }));
    }
  };

  const handleResendReceiverEmail = async () => {
    if (!id) return;
    
    try {
      setIsResendingEmail(prev => ({ ...prev, receiver: true }));
      const success = await resendReceiverAvailabilityEmail(id);
      
      if (success) {
        toast.success("Email resent to receiver successfully");
      } else {
        toast.error("Failed to resend email to receiver");
      }
    } catch (error) {
      console.error("Error resending receiver email:", error);
      toast.error(`Failed to resend email: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsResendingEmail(prev => ({ ...prev, receiver: false }));
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-courier-600"></div>
        </div>
      </Layout>
    );
  }

  if (error || !order) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <h2 className="text-xl font-semibold text-red-600">{error || "Order not found"}</h2>
          <Button asChild>
            <Link to="/dashboard">
              <ArrowLeft className="mr-2" />
              Return to Dashboard
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const itemName = `${order.bikeBrand || ""} ${order.bikeModel || ""}`.trim() || "Bike";

  const canSchedule = (
    order.status === 'scheduled_dates_pending' || 
    order.status === 'pending_approval' || 
    order.status === 'receiver_availability_confirmed'
  ) && Array.isArray(order.pickupDate) && order.pickupDate.length > 0 && 
    Array.isArray(order.deliveryDate) && order.deliveryDate.length > 0;

  const isScheduled = order.status === 'scheduled' || order.status === 'shipped' || order.status === 'delivered';
  const hasScheduledDates = order.scheduledPickupDate && order.scheduledDeliveryDate;

  const needsSenderConfirmation = order.status === 'created' || order.status === 'sender_availability_pending';
  const needsReceiverConfirmation = order.status === 'sender_availability_confirmed' || order.status === 'receiver_availability_pending';
  
  // Update this to true so admin controls are visible
  const showAdminControls = true;

  return (
    <Layout>
      <div className="space-y-6">
        <OrderHeader 
          status={order.status}
          statusUpdating={statusUpdating}
          selectedStatus={selectedStatus}
          onStatusChange={handleStatusChange}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Package className="mr-2" />
                {itemName} {order.customerOrderNumber ? `(${order.customerOrderNumber})` : `(Order #${order.id.substring(0, 8)})`}
              </div>
              <EmailResendButtons 
                needsSenderConfirmation={needsSenderConfirmation}
                needsReceiverConfirmation={needsReceiverConfirmation}
                isResendingSender={isResendingEmail.sender}
                isResendingReceiver={isResendingEmail.receiver}
                onResendSenderEmail={handleResendSenderEmail}
                onResendReceiverEmail={handleResendReceiverEmail}
              />
            </CardTitle>
            <CardDescription>
              Created on {format(new Date(order.createdAt), "PPP")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.trackingNumber && (
              <div className="bg-muted p-3 rounded-md">
                <p className="font-medium">Tracking Number: {order.trackingNumber}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <DateSelection 
                  title="Pickup Dates"
                  availableDates={order.pickupDate}
                  scheduledDate={order.scheduledPickupDate}
                  selectedDate={selectedPickupDate}
                  setSelectedDate={setSelectedPickupDate}
                  timeValue={pickupTime}
                  setTimeValue={setPickupTime}
                  calendarDate={pickupDatePicker}
                  setCalendarDate={setPickupDatePicker}
                  isSubmitting={isSubmitting}
                  isScheduled={isScheduled}
                  showAdminControls={showAdminControls}
                />
                
                <DateSelection 
                  title="Delivery Dates"
                  availableDates={order.deliveryDate}
                  scheduledDate={order.scheduledDeliveryDate}
                  selectedDate={selectedDeliveryDate}
                  setSelectedDate={setSelectedDeliveryDate}
                  timeValue={deliveryTime}
                  setTimeValue={setDeliveryTime}
                  calendarDate={deliveryDatePicker}
                  setCalendarDate={setDeliveryDatePicker}
                  isSubmitting={isSubmitting}
                  isScheduled={isScheduled}
                  showAdminControls={showAdminControls}
                />
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <p>Last Updated: {format(new Date(order.updatedAt), "PPP 'at' p")}</p>
                </div>
                
                <div className="space-y-4">
                  {canSchedule && !isScheduled && (
                    <div className="mt-6">
                      <Button 
                        onClick={handleScheduleOrder} 
                        disabled={!selectedPickupDate || !selectedDeliveryDate || isSubmitting}
                        className="w-full"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                            Scheduling Order...
                          </>
                        ) : (
                          "Schedule Order"
                        )}
                      </Button>
                    </div>
                  )}
                  
                  {showAdminControls && !isScheduled && (
                    <div className="mt-6 border-t pt-4">
                      <Button 
                        onClick={handleAdminScheduleOrder} 
                        disabled={!pickupDatePicker || !deliveryDatePicker || isSubmitting}
                        className="w-full mb-3"
                        variant="default"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                            Scheduling Order...
                          </>
                        ) : (
                          "Admin: Schedule Order"
                        )}
                      </Button>
                      
                      {hasScheduledDates && (
                        <Button 
                          onClick={handleCreateShipments} 
                          disabled={isCreatingShipments || !hasScheduledDates}
                          className="w-full"
                          variant="outline"
                        >
                          {isCreatingShipments ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary mr-2"></div>
                              Creating Shipments...
                            </>
                          ) : (
                            "Create Shipments"
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <Separator className="my-6" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ItemDetails order={order} />
              <TrackingTimeline order={order} />
            </div>
            
            <Separator className="my-6" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <ContactDetails 
                type="sender"
                contact={order.sender}
                notes={order.senderNotes}
              />
              
              <ContactDetails 
                type="receiver"
                contact={order.receiver}
                notes={order.receiverNotes}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link to="/dashboard">
                <ArrowLeft className="mr-2" />
                Return to Dashboard
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
};

export default OrderDetail;
