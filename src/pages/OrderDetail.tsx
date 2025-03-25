
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Truck, Package, User, Phone, Mail, MapPin, Check, FileText, RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import { getOrderById, updateOrderSchedule, updateAdminOrderStatus, resendSenderAvailabilityEmail, resendReceiverAvailabilityEmail } from "@/services/orderService";
import { createShipdayOrder } from "@/services/shipdayService";
import { Order, OrderStatus } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/StatusBadge";
import Layout from "@/components/Layout";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: "created", label: "Created" },
  { value: "sender_availability_pending", label: "Sender Availability Pending" },
  { value: "sender_availability_confirmed", label: "Sender Availability Confirmed" },
  { value: "receiver_availability_pending", label: "Receiver Availability Pending" },
  { value: "receiver_availability_confirmed", label: "Receiver Availability Confirmed" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "scheduled", label: "Scheduled" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

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
  const [isResendingEmail, setIsResendingEmail] = useState<{sender: boolean; receiver: boolean}>({ sender: false, receiver: false });
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | null>(null);
  
  // For the date pickers
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
      
      // Combine date and time for pickup
      const pickupDateTime = new Date(selectedPickupDate);
      const [pickupHours, pickupMinutes] = pickupTime.split(':').map(Number);
      pickupDateTime.setHours(pickupHours, pickupMinutes, 0);
      
      // Combine date and time for delivery
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
      
      // Pass times to Shipday
      const shipdayResponse = await createShipdayOrder(id);
      
      if (shipdayResponse) {
        setOrder(updatedOrder);
        toast.success("Order has been scheduled and shipments created successfully");
      } else {
        toast.error("Failed to create shipments");
      }
    } catch (error) {
      console.error("Error scheduling order:", error);
      toast.error(`Failed to schedule order: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminScheduleOrder = async () => {
    if (!id || !pickupDatePicker || !deliveryDatePicker) {
      toast.error("Please select both pickup and delivery dates");
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Combine date and time for pickup
      const pickupDateTime = new Date(pickupDatePicker);
      const [pickupHours, pickupMinutes] = pickupTime.split(':').map(Number);
      pickupDateTime.setHours(pickupHours, pickupMinutes, 0);
      
      // Combine date and time for delivery
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

  const formatDate = (date: Date | undefined) => {
    if (!date) return "Not scheduled";
    return format(new Date(date), "PPP");
  };

  const formatDates = (dates: Date | Date[] | undefined) => {
    if (!dates) return "Not scheduled";
    
    if (Array.isArray(dates)) {
      return dates.map(date => format(new Date(date), "PPP")).join(", ");
    }
    
    return format(new Date(dates), "PPP");
  };

  const canSchedule = (order.status === 'pending_approval' || order.status === 'receiver_availability_confirmed') && 
                     Array.isArray(order.pickupDate) && order.pickupDate.length > 0 && 
                     Array.isArray(order.deliveryDate) && order.deliveryDate.length > 0;

  const isScheduled = order.status === 'scheduled' || order.status === 'shipped' || order.status === 'delivered';

  const needsSenderConfirmation = order.status === 'created' || order.status === 'sender_availability_pending';
  const needsReceiverConfirmation = order.status === 'sender_availability_confirmed' || order.status === 'receiver_availability_pending';

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="mr-2" />
                Back
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Order Details</h1>
          </div>
          <div className="flex items-center space-x-3">
            <StatusBadge status={order.status} />
            <Select 
              value={selectedStatus || undefined} 
              onValueChange={(value) => handleStatusChange(value as OrderStatus)}
              disabled={statusUpdating}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Change status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Package className="mr-2" />
                Order #{order.id.substring(0, 8)}
              </div>
              <div className="flex space-x-2">
                {needsSenderConfirmation && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleResendSenderEmail}
                    disabled={isResendingEmail.sender}
                  >
                    {isResendingEmail.sender ? (
                      <div className="flex items-center space-x-1">
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-courier-600"></div>
                        <span>Sending...</span>
                      </div>
                    ) : (
                      <>
                        <RefreshCcw className="mr-2 h-4 w-4" /> 
                        Resend Sender Email
                      </>
                    )}
                  </Button>
                )}
                {needsReceiverConfirmation && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleResendReceiverEmail}
                    disabled={isResendingEmail.receiver}
                  >
                    {isResendingEmail.receiver ? (
                      <div className="flex items-center space-x-1">
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-courier-600"></div>
                        <span>Sending...</span>
                      </div>
                    ) : (
                      <>
                        <RefreshCcw className="mr-2 h-4 w-4" /> 
                        Resend Receiver Email
                      </>
                    )}
                  </Button>
                )}
              </div>
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
                <div className="flex items-center space-x-2">
                  <Calendar className="text-courier-600" />
                  <h3 className="font-semibold">Pickup Dates</h3>
                </div>
                
                {canSchedule ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Available dates:</p>
                    <p>{formatDates(order.pickupDate)}</p>
                    
                    <div className="mt-2">
                      <label className="text-sm font-medium">Select pickup date:</label>
                      <Select
                        value={selectedPickupDate || ""}
                        onValueChange={setSelectedPickupDate}
                        disabled={isSubmitting || isScheduled}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a date" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(order.pickupDate) && order.pickupDate.map((date, index) => (
                            <SelectItem key={index} value={new Date(date).toISOString()}>
                              {format(new Date(date), "PPP")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="mt-2">
                      <label className="text-sm font-medium">Select pickup time:</label>
                      <Input
                        type="time"
                        value={pickupTime}
                        onChange={(e) => setPickupTime(e.target.value)}
                        disabled={isSubmitting || isScheduled}
                        className="w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {order.scheduledPickupDate ? (
                      <div className="bg-green-50 p-2 rounded-md border border-green-200">
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-600 mr-2" />
                          <p className="font-medium">
                            {format(new Date(order.scheduledPickupDate), "PPP 'at' p")}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p>{formatDates(order.pickupDate)}</p>
                    )}
                    
                    {/* Admin date picker for pickup */}
                    <div className="space-y-2 border-t pt-4 mt-4">
                      <h4 className="text-sm font-medium">Admin: Set Pickup Date</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !pickupDatePicker && "text-muted-foreground"
                                )}
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                {pickupDatePicker ? format(pickupDatePicker, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={pickupDatePicker}
                                onSelect={setPickupDatePicker}
                                initialFocus
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        <Input
                          type="time"
                          value={pickupTime}
                          onChange={(e) => setPickupTime(e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  <Calendar className="text-courier-600" />
                  <h3 className="font-semibold">Delivery Dates</h3>
                </div>
                
                {canSchedule ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Available dates:</p>
                    <p>{formatDates(order.deliveryDate)}</p>
                    
                    <div className="mt-2">
                      <label className="text-sm font-medium">Select delivery date:</label>
                      <Select
                        value={selectedDeliveryDate || ""}
                        onValueChange={setSelectedDeliveryDate}
                        disabled={isSubmitting || isScheduled}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a date" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(order.deliveryDate) && order.deliveryDate.map((date, index) => (
                            <SelectItem key={index} value={new Date(date).toISOString()}>
                              {format(new Date(date), "PPP")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="mt-2">
                      <label className="text-sm font-medium">Select delivery time:</label>
                      <Input
                        type="time"
                        value={deliveryTime}
                        onChange={(e) => setDeliveryTime(e.target.value)}
                        disabled={isSubmitting || isScheduled}
                        className="w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {order.scheduledDeliveryDate ? (
                      <div className="bg-green-50 p-2 rounded-md border border-green-200">
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-600 mr-2" />
                          <p className="font-medium">
                            {format(new Date(order.scheduledDeliveryDate), "PPP 'at' p")}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p>{formatDates(order.deliveryDate)}</p>
                    )}
                    
                    {/* Admin date picker for delivery */}
                    <div className="space-y-2 border-t pt-4 mt-4">
                      <h4 className="text-sm font-medium">Admin: Set Delivery Date</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !deliveryDatePicker && "text-muted-foreground"
                                )}
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                {deliveryDatePicker ? format(deliveryDatePicker, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={deliveryDatePicker}
                                onSelect={setDeliveryDatePicker}
                                initialFocus
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        <Input
                          type="time"
                          value={deliveryTime}
                          onChange={(e) => setDeliveryTime(e.target.value)}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Truck className="text-courier-600" />
                  <h3 className="font-semibold">Last Updated</h3>
                </div>
                <p>{format(new Date(order.updatedAt), "PPP 'at' p")}</p>
                
                {canSchedule && (
                  <div className="mt-6">
                    <Button 
                      onClick={handleScheduleOrder} 
                      disabled={!selectedPickupDate || !selectedDeliveryDate || isSubmitting || isScheduled}
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
                
                {/* Admin can schedule regardless of status */}
                <div className="mt-6 border-t pt-4">
                  <Button 
                    onClick={handleAdminScheduleOrder} 
                    disabled={!pickupDatePicker || !deliveryDatePicker || isSubmitting}
                    className="w-full"
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
                </div>
              </div>
            </div>
            
            <Separator className="my-6" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <User className="text-courier-600" />
                  <h3 className="font-semibold text-lg">Sender Information</h3>
                </div>
                <div className="bg-gray-50 p-4 rounded-md space-y-3">
                  <p className="font-medium text-gray-800">{order.sender.name}</p>
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <Mail className="h-4 w-4 mt-1 text-gray-500" />
                      <p>{order.sender.email}</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <Phone className="h-4 w-4 mt-1 text-gray-500" />
                      <p>{order.sender.phone}</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 mt-1 text-gray-500" />
                      <div>
                        <p>{order.sender.address.street}</p>
                        <p>{order.sender.address.city}, {order.sender.address.state} {order.sender.address.zipCode}</p>
                        <p>{order.sender.address.country}</p>
                      </div>
                    </div>
                    {order.senderNotes && (
                      <div className="flex items-start space-x-2 mt-2 pt-2 border-t border-gray-200">
                        <FileText className="h-4 w-4 mt-1 text-gray-500" />
                        <div>
                          <p className="font-medium mb-1">Sender Notes:</p>
                          <p className="text-sm">{order.senderNotes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <User className="text-courier-600" />
                  <h3 className="font-semibold text-lg">Receiver Information</h3>
                </div>
                <div className="bg-gray-50 p-4 rounded-md space-y-3">
                  <p className="font-medium text-gray-800">{order.receiver.name}</p>
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <Mail className="h-4 w-4 mt-1 text-gray-500" />
                      <p>{order.receiver.email}</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <Phone className="h-4 w-4 mt-1 text-gray-500" />
                      <p>{order.receiver.phone}</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 mt-1 text-gray-500" />
                      <div>
                        <p>{order.receiver.address.street}</p>
                        <p>{order.receiver.address.city}, {order.receiver.address.state} {order.receiver.address.zipCode}</p>
                        <p>{order.receiver.address.country}</p>
                      </div>
                    </div>
                    {order.receiverNotes && (
                      <div className="flex items-start space-x-2 mt-2 pt-2 border-t border-gray-200">
                        <FileText className="h-4 w-4 mt-1 text-gray-500" />
                        <div>
                          <p className="font-medium mb-1">Receiver Notes:</p>
                          <p className="text-sm">{order.receiverNotes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
