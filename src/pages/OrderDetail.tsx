
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Package, Printer } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { getOrderById, updateOrderSchedule, updateAdminOrderStatus, resendSenderAvailabilityEmail, resendReceiverAvailabilityEmail } from "@/services/orderService";
import { createShipdayOrder } from "@/services/shipdayService";
import { Order, OrderStatus } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Layout from "@/components/Layout";
import { toast } from "sonner";
import OrderHeader from "@/components/order-detail/OrderHeader";
import DateSelection from "@/components/order-detail/DateSelection";
import TrackingTimeline from "@/components/order-detail/TrackingTimeline";
import ItemDetails from "@/components/order-detail/ItemDetails";
import ContactDetails from "@/components/order-detail/ContactDetails";
import SchedulingButtons from "@/components/order-detail/SchedulingButtons";
import EmailResendButtons from "@/components/order-detail/EmailResendButtons";
import OrderComments from "@/components/order-detail/OrderComments";
import TimeslotSelection from "@/components/order-detail/TimeslotSelection";
import { pollOrderUpdates } from "@/services/orderService";
import { supabase } from "@/integrations/supabase/client";
import { mapDbOrderToOrderType } from "@/services/orderServiceUtils";
import { generateSingleOrderLabel } from "@/utils/labelUtils";

const safeFormat = (date: Date | string | null | undefined, formatStr: string): string => {
  if (!date) return "";
  
  try {
    if (typeof date === 'string' && date.trim() === '') {
      return "";
    }
    
    let dateObj: Date;
    
    if (typeof date === 'string') {
      try {
        if (date.includes('T') || date.includes('-')) {
          dateObj = parseISO(date);
        } else {
          dateObj = new Date(date);
        }
      } catch (parseError) {
        console.warn("Failed to parse date string in OrderDetail:", date, parseError);
        return "Invalid date format";
      }
    } else {
      dateObj = date as Date;
    }
    
    // Enhanced date validation to prevent Invalid time value errors
    if (!dateObj || !(dateObj instanceof Date)) {
      console.warn("Invalid date detected in OrderDetail:", date);
      return "Invalid date";
    }
    
    // Check for NaN time value
    const timeValue = dateObj.getTime();
    if (isNaN(timeValue)) {
      console.warn("NaN time value detected in OrderDetail:", date);
      return "Invalid date";
    }
    
    // Check for extreme date values that might cause issues
    if (timeValue < -8640000000000000 || timeValue > 8640000000000000) {
      console.warn("Extreme date value detected in OrderDetail:", date, timeValue);
      return "Invalid date";
    }
    
    // Additional safety check for invalid time values by testing toISOString
    try {
      dateObj.toISOString();
    } catch (timeError) {
      console.error("Invalid time value in date object:", dateObj, timeError);
      return "Invalid time";
    }
    
    // Finally format the date
    try {
      return format(dateObj, formatStr);
    } catch (formatError) {
      console.error("Error formatting valid date:", dateObj, formatError);
      return "Format error";
    }
  } catch (error) {
    console.error("Error formatting date in OrderDetail:", error, date);
    return "Date error";
  }
};

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
            try {
              const pickupDate = new Date(fetchedOrder.scheduledPickupDate);
              if (!isNaN(pickupDate.getTime())) {
                setSelectedPickupDate(pickupDate.toISOString());
                setPickupDatePicker(pickupDate);
              } else {
                console.warn("Invalid scheduledPickupDate detected:", fetchedOrder.scheduledPickupDate);
              }
            } catch (err) {
              console.error("Error parsing scheduledPickupDate:", err);
            }
          }
          
          if (fetchedOrder.scheduledDeliveryDate) {
            try {
              const deliveryDate = new Date(fetchedOrder.scheduledDeliveryDate);
              if (!isNaN(deliveryDate.getTime())) {
                setSelectedDeliveryDate(deliveryDate.toISOString());
                setDeliveryDatePicker(deliveryDate);
              } else {
                console.warn("Invalid scheduledDeliveryDate detected:", fetchedOrder.scheduledDeliveryDate);
              }
            } catch (err) {
              console.error("Error parsing scheduledDeliveryDate:", err);
            }
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

  useEffect(() => {
    if (order?.id) {
      const cleanup = pollOrderUpdates(order.id, (updatedOrder) => {
        setOrder(updatedOrder);
      }, 5000); // Poll every 5 seconds
      
      return cleanup;
    }
  }, [order?.id]);

  const handleSchedulePickup = async () => {
    if (!id || !selectedPickupDate) {
      toast.error("Please select pickup date");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const pickupDateTime = new Date(selectedPickupDate);
      const [pickupHours, pickupMinutes] = pickupTime.split(':').map(Number);
      pickupDateTime.setUTCHours(pickupHours, pickupMinutes, 0);
      
      const updatedOrder = await updateOrderSchedule(
        id, 
        pickupDateTime,
        undefined
      );
      
      if (!updatedOrder) {
        throw new Error("Failed to update order schedule");
      }

      const shipdayResponse = await createShipdayOrder(id, 'pickup');
      
      if (shipdayResponse) {
        setOrder(updatedOrder);
        toast.success("Pickup has been scheduled and shipment created successfully");
      } else {
        setOrder(updatedOrder);
        toast.warning("Pickup scheduled but failed to create shipment");
      }
    } catch (error) {
      console.error("Error scheduling pickup:", error);
      toast.error(`Failed to schedule pickup: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleDelivery = async () => {
    if (!id) {
      toast.error("Order ID is missing");
      return;
    }

    try {
      setIsSubmitting(true);
      
      let deliveryDateTime: Date;
      
      // Handle direct date picker for 'collected' status
      if (order?.status === 'collected' && deliveryDatePicker) {
        deliveryDateTime = new Date(deliveryDatePicker);
        const [deliveryHours, deliveryMinutes] = deliveryTime.split(':').map(Number);
        deliveryDateTime.setUTCHours(deliveryHours, deliveryMinutes, 0);
      } else if (selectedDeliveryDate) {
        deliveryDateTime = new Date(selectedDeliveryDate);
        const [deliveryHours, deliveryMinutes] = deliveryTime.split(':').map(Number);
        deliveryDateTime.setUTCHours(deliveryHours, deliveryMinutes, 0);
      } else {
        toast.error("Please select delivery date");
        setIsSubmitting(false);
        return;
      }
      
      // For collected orders, reuse the existing pickup date
      let pickupDateTime = undefined;
      if (order?.status === 'collected' && order.scheduledPickupDate) {
        pickupDateTime = new Date(order.scheduledPickupDate);
      }

      if (order?.scheduledPickupDate) {
        const existingPickupDate = new Date(order.scheduledPickupDate);
        if (deliveryDateTime <= existingPickupDate) {
          toast.error("Delivery date must be after the pickup date");
          setIsSubmitting(false);
          return;
        }
      }
      
      const updatedOrder = await updateOrderSchedule(
        id,
        pickupDateTime, // Pass existing pickup date for collected orders
        deliveryDateTime
      );
      
      if (!updatedOrder) {
        throw new Error("Failed to update order schedule");
      }

      const shipdayResponse = await createShipdayOrder(id, 'delivery');
      
      if (shipdayResponse) {
        setOrder(updatedOrder);
        toast.success("Delivery has been scheduled and shipment created successfully");
      } else {
        setOrder(updatedOrder);
        toast.warning("Delivery scheduled but failed to create shipment");
      }
    } catch (error) {
      console.error("Error scheduling delivery:", error);
      toast.error(`Failed to schedule delivery: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleOrder = async () => {
    if (!id || !selectedPickupDate || !selectedDeliveryDate) {
      toast.error("Please select both pickup and delivery dates");
      return;
    }

    const pickupDateTime = new Date(selectedPickupDate);
    const deliveryDateTime = new Date(selectedDeliveryDate);

    if (deliveryDateTime <= pickupDateTime) {
      toast.error("Delivery date must be after the pickup date");
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Set dates to noon UTC to avoid timezone conversion issues
      const pickupDateOnly = new Date(pickupDateTime);
      pickupDateOnly.setUTCHours(12, 0, 0, 0);
      
      const deliveryDateOnly = new Date(deliveryDateTime);
      deliveryDateOnly.setUTCHours(12, 0, 0, 0);
      
      const updatedOrder = await updateOrderSchedule(
        id, 
        pickupDateOnly,
        deliveryDateOnly
      );
      
      if (!updatedOrder) {
        throw new Error("Failed to update order schedule");
      }

      // Save timeslots separately
      const { error: timeslotError } = await supabase
        .from('orders')
        .update({ 
          pickup_timeslot: pickupTime,
          delivery_timeslot: deliveryTime 
        })
        .eq('id', id);

      if (timeslotError) {
        console.error("Error saving timeslots:", timeslotError);
        // Continue anyway, main scheduling worked
      }

      const shipdayResponse = await createShipdayOrder(id);
      
      if (shipdayResponse) {
        setOrder(updatedOrder);
        toast.success("Order has been scheduled and shipments created successfully");
      } else {
        setOrder(updatedOrder);
        toast.warning("Order scheduled but failed to create shipments");
      }
    } catch (error) {
      console.error("Error scheduling order:", error);
      toast.error(`Failed to schedule order: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetCollectionDate = async () => {
    if (!id) return;

    try {
      setIsSubmitting(true);
      
      let pickupDateTime = undefined;
      
      // Check for pickup date from either dropdown selection or date picker
      if (selectedPickupDate) {
        pickupDateTime = new Date(selectedPickupDate);
        // Set time to noon UTC to avoid timezone conversion issues
        pickupDateTime.setUTCHours(12, 0, 0, 0);
      } else if (pickupDatePicker) {
        pickupDateTime = new Date(pickupDatePicker);
        // Set time to noon UTC to avoid timezone conversion issues
        pickupDateTime.setUTCHours(12, 0, 0, 0);
      }

      if (!pickupDateTime) {
        toast.error("Please select a collection date");
        return;
      }
      
      // Prepare update object - ONLY update pickup date, no status changes
      const updateData: any = {
        scheduled_pickup_date: pickupDateTime.toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Only update timeslot if one doesn't exist
      if (!order?.pickupTimeslot) {
        updateData.pickup_timeslot = null;
      }
      
      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      const mappedOrder = mapDbOrderToOrderType(data);
      setOrder(mappedOrder);
      
      toast.success("Collection date set successfully");
    } catch (error) {
      console.error("Error setting collection date:", error);
      toast.error(`Failed to set collection date: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDeliveryDate = async () => {
    if (!id) return;

    try {
      setIsSubmitting(true);
      
      let deliveryDateTime = undefined;
      
      // Check for delivery date from either dropdown selection or date picker
      if (selectedDeliveryDate) {
        deliveryDateTime = new Date(selectedDeliveryDate);
        // Set time to noon UTC to avoid timezone conversion issues
        deliveryDateTime.setUTCHours(12, 0, 0, 0);
      } else if (deliveryDatePicker) {
        deliveryDateTime = new Date(deliveryDatePicker);
        // Set time to noon UTC to avoid timezone conversion issues
        deliveryDateTime.setUTCHours(12, 0, 0, 0);
      }

      if (!deliveryDateTime) {
        toast.error("Please select a delivery date");
        return;
      }
      
      // Prepare update object - ONLY update delivery date, no status changes
      const updateData: any = {
        scheduled_delivery_date: deliveryDateTime.toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Only update timeslot if one doesn't exist
      if (!order?.deliveryTimeslot) {
        updateData.delivery_timeslot = null;
      }
      
      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      const mappedOrder = mapDbOrderToOrderType(data);
      setOrder(mappedOrder);
      
      toast.success("Delivery date set successfully");
    } catch (error) {
      console.error("Error setting delivery date:", error);
      toast.error(`Failed to set delivery date: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPickupDate = async () => {
    try {
      setIsSubmitting(true);
      
      const { error } = await supabase
        .from('orders')
        .update({
          scheduled_pickup_date: null,
          pickup_timeslot: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setPickupDatePicker(undefined);
      setSelectedPickupDate(null);
      setPickupTime("09:00");
      
      // Refresh order data
      if (id) {
        const updatedOrder = await getOrderById(id);
        if (updatedOrder) {
          setOrder(updatedOrder);
        }
      }
      
      toast.success("Collection date and timeslot reset");
    } catch (error) {
      console.error("Error resetting pickup date:", error);
      toast.error("Failed to reset collection date");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetDeliveryDate = async () => {
    try {
      setIsSubmitting(true);
      
      const { error } = await supabase
        .from('orders')
        .update({
          scheduled_delivery_date: null,
          delivery_timeslot: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setDeliveryDatePicker(undefined);
      setSelectedDeliveryDate(null);
      setDeliveryTime("09:00");
      
      // Refresh order data
      if (id) {
        const updatedOrder = await getOrderById(id);
        if (updatedOrder) {
          setOrder(updatedOrder);
        }
      }
      
      toast.success("Delivery date and timeslot reset");
    } catch (error) {
      console.error("Error resetting delivery date:", error);
      toast.error("Failed to reset delivery date");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPickupToShipday = async () => {
    console.log("handleAddPickupToShipday called", { id, isSubmitting });
    if (!id) return;
    
    try {
      setIsSubmitting(true);
      console.log("About to call createShipdayOrder for pickup");
      
      const shipdayResponse = await createShipdayOrder(id, 'pickup');
      console.log("Shipday pickup response:", shipdayResponse);
      
      if (shipdayResponse) {
        toast.success("Collection added to Shipday successfully");
      } else {
        toast.error("Failed to add collection to Shipday");
      }
    } catch (error) {
      console.error("Error adding collection to Shipday:", error);
      toast.error(`Failed to add collection to Shipday: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddDeliveryToShipday = async () => {
    console.log("handleAddDeliveryToShipday called", { id, isSubmitting });
    if (!id) return;
    
    try {
      setIsSubmitting(true);
      console.log("About to call createShipdayOrder for delivery");
      
      const shipdayResponse = await createShipdayOrder(id, 'delivery');
      console.log("Shipday delivery response:", shipdayResponse);
      
      if (shipdayResponse) {
        toast.success("Delivery added to Shipday successfully");
      } else {
        toast.error("Failed to add delivery to Shipday");
      }
    } catch (error) {
      console.error("Error adding delivery to Shipday:", error);
      toast.error(`Failed to add delivery to Shipday: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!id) return;
    
    try {
      setIsSubmitting(true);
      
      const jobType = order?.status === 'collection_scheduled' ? 'pickup' : 'delivery';
      
      const shipdayResponse = await createShipdayOrder(id, jobType);
      
      if (shipdayResponse) {
        toast.success(`${jobType === 'pickup' ? 'Collection' : 'Delivery'} shipment created successfully`);
      } else {
        toast.error(`Failed to create ${jobType} shipment`);
      }
    } catch (error) {
      console.error("Error creating shipment:", error);
      toast.error(`Failed to create shipment: ${error instanceof Error ? error.message : "Unknown error"}`);
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
      
      const shipdayResponse = await createShipdayOrder(id);
      
      if (shipdayResponse) {
        setOrder(updatedOrder);
        toast.success("Order has been scheduled and shipments created successfully");
      } else {
        setOrder(updatedOrder);
        toast.warning("Order scheduled but failed to create shipments in Shipday");
      }
    } catch (error) {
      console.error("Error scheduling order:", error);
      toast.error(`Failed to schedule order: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminSchedulePickup = async () => {
    if (!id || !pickupDatePicker) {
      toast.error("Please select pickup date");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const pickupDateTime = new Date(pickupDatePicker);
      const [pickupHours, pickupMinutes] = pickupTime.split(':').map(Number);
      pickupDateTime.setHours(pickupHours, pickupMinutes, 0);
      
      const updatedOrder = await updateOrderSchedule(
        id, 
        pickupDateTime, 
        undefined // No delivery date
      );
      
      if (!updatedOrder) {
        throw new Error("Failed to update order schedule");
      }
      
      const shipdayResponse = await createShipdayOrder(id, 'pickup');
      
      if (shipdayResponse) {
        setOrder(updatedOrder);
        toast.success("Collection has been scheduled and shipment created successfully");
      } else {
        setOrder(updatedOrder);
        toast.warning("Collection scheduled but failed to create shipment in Shipday");
      }
    } catch (error) {
      console.error("Error scheduling pickup:", error);
      toast.error(`Failed to schedule pickup: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminScheduleDelivery = async () => {
    if (!id || !deliveryDatePicker) {
      toast.error("Please select delivery date");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const deliveryDateTime = new Date(deliveryDatePicker);
      const [deliveryHours, deliveryMinutes] = deliveryTime.split(':').map(Number);
      deliveryDateTime.setHours(deliveryHours, deliveryMinutes, 0);
      
      // Preserve existing pickup date if available
      let pickupDateTime = undefined;
      if (order?.scheduledPickupDate) {
        pickupDateTime = new Date(order.scheduledPickupDate);
      }
      
      const updatedOrder = await updateOrderSchedule(
        id,
        pickupDateTime, // Preserve existing pickup
        deliveryDateTime
      );
      
      if (!updatedOrder) {
        throw new Error("Failed to update order schedule");
      }
      
      const shipdayResponse = await createShipdayOrder(id, 'delivery');
      
      if (shipdayResponse) {
        setOrder(updatedOrder);
        toast.success("Delivery has been scheduled and shipment created successfully");
      } else {
        setOrder(updatedOrder);
        toast.warning("Delivery scheduled but failed to create shipment in Shipday");
      }
    } catch (error) {
      console.error("Error scheduling delivery:", error);
      toast.error(`Failed to schedule delivery: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!id || !newStatus || newStatus === order?.status) return;
    
    try {
      setStatusUpdating(true);
      let updatedOrder;
      
      if (newStatus === 'scheduled_dates_pending') {
        const { data, error } = await supabase
          .from('orders')
          .update({ 
            status: newStatus,
            scheduled_pickup_date: null,
            scheduled_delivery_date: null,
            scheduled_at: null
          })
          .eq('id', id)
          .select()
          .single();
          
        if (error) throw error;
        updatedOrder = data;
      } else {
        updatedOrder = await updateAdminOrderStatus(id, newStatus);
      }
      
      if (updatedOrder) {
        const mappedOrder = mapDbOrderToOrderType(updatedOrder);
        setOrder(mappedOrder);
        setSelectedStatus(newStatus);
        
        // Don't clear date pickers when changing status
        
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

  // Allow delivery scheduling when status is "collected"
  const canSchedule = (
    order.status === 'scheduled_dates_pending' ||
    order.status === 'pending_approval' ||
    order.status === 'receiver_availability_confirmed' ||
    order.status === 'collected'
  ) && (
    // For collected orders, we don't require available dates since we'll use direct date picker
    order.status === 'collected' || 
    (Array.isArray(order.pickupDate) && order.pickupDate.length > 0 &&
    Array.isArray(order.deliveryDate) && order.deliveryDate.length > 0)
  );

  const isScheduled = order.status === 'scheduled' || order.status === 'shipped' || order.status === 'delivered';

  const needsSenderConfirmation = order.status === 'created' || order.status === 'sender_availability_pending';
  const needsReceiverConfirmation = order.status === 'sender_availability_confirmed' || order.status === 'receiver_availability_pending';
  
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
                {itemName} {order.customerOrderNumber ? `(${order.customerOrderNumber})` : ''}
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => generateSingleOrderLabel(order)}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print Label
                </Button>
                <EmailResendButtons 
                  needsSenderConfirmation={needsSenderConfirmation}
                  needsReceiverConfirmation={needsReceiverConfirmation}
                  isResendingSender={isResendingEmail.sender}
                  isResendingReceiver={isResendingEmail.receiver}
                  onResendSenderEmail={handleResendSenderEmail}
                  onResendReceiverEmail={handleResendReceiverEmail}
                />
              </div>
            </CardTitle>
            <CardDescription>
              Created on {safeFormat(order.createdAt, "PPP")}
            </CardDescription>
            <CardDescription>
              Last Updated: {safeFormat(order.updatedAt, "PPP 'at' p")}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {order.trackingNumber && (
              <div className="bg-muted p-3 rounded-md">
                <p className="font-medium">Tracking Number: {order.trackingNumber}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  orderStatus={order.status}
                  timeslot={order.pickupTimeslot}
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
                  orderStatus={order.status}
                  timeslot={order.deliveryTimeslot}
                />
              </div>

              <SchedulingButtons 
                orderId={id as string}
                onSchedulePickup={handleSchedulePickup}
                onScheduleDelivery={handleScheduleDelivery}
                onScheduleBoth={handleScheduleOrder}
                onAdminScheduleBoth={handleAdminScheduleOrder}
                onAdminSchedulePickup={handleAdminSchedulePickup}
                onAdminScheduleDelivery={handleAdminScheduleDelivery}
                isSubmitting={isSubmitting}
                isScheduled={isScheduled}
                pickupDateSelected={!!selectedPickupDate}
                deliveryDateSelected={!!selectedDeliveryDate}
                status={order.status}
                pickupDatePicker={pickupDatePicker}
                deliveryDatePicker={deliveryDatePicker}
                deliveryDate={deliveryDatePicker}
                setDeliveryDate={setDeliveryDatePicker}
                deliveryTime={deliveryTime}
                setDeliveryTime={setDeliveryTime}
              />
              
              {/* Admin Control Buttons */}
              <div className="flex flex-col gap-2 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    onClick={handleSetCollectionDate}
                    disabled={isSubmitting}
                    variant="secondary"
                    className="w-full"
                  >
                    {isSubmitting ? "Setting Collection Date..." : "Set Collection Date"}
                  </Button>
                  <Button 
                    onClick={handleSetDeliveryDate}
                    disabled={isSubmitting}
                    variant="secondary"
                    className="w-full"
                  >
                    {isSubmitting ? "Setting Delivery Date..." : "Set Delivery Date"}
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    onClick={handleResetPickupDate}
                    variant="destructive"
                    size="sm"
                    className="w-full"
                  >
                    Reset Collection Date
                  </Button>
                  <Button 
                    onClick={handleResetDeliveryDate}
                    variant="destructive"
                    size="sm"
                    className="w-full"
                  >
                    Reset Delivery Date
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    onClick={handleAddPickupToShipday}
                    disabled={isSubmitting}
                    variant="outline"
                    className="w-full"
                  >
                    {isSubmitting ? "Adding..." : "Add Collection to Shipday"}
                  </Button>
                  <Button 
                    onClick={handleAddDeliveryToShipday}
                    disabled={isSubmitting}
                    variant="outline"
                    className="w-full"
                  >
                    {isSubmitting ? "Adding..." : "Add Delivery to Shipday"}
                  </Button>
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
              <div className="space-y-4">
                <ContactDetails 
                  type="sender"
                  contact={order.sender}
                  notes={order.senderNotes}
                />
                <TimeslotSelection 
                  type="sender"
                  orderId={order.id}
                  order={order}
                />
              </div>
              
              <div className="space-y-4">
                <ContactDetails 
                  type="receiver"
                  contact={order.receiver}
                  notes={order.receiverNotes}
                />
                <TimeslotSelection 
                  type="receiver"
                  orderId={order.id}
                  order={order}
                />
              </div>
            </div>
            
            <Separator className="my-6" />
            
            <OrderComments orderId={order.id} />
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
