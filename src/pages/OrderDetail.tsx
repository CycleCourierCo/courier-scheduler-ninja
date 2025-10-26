
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Package, Printer } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { getOrderById, updateOrderSchedule, updateAdminOrderStatus, resendSenderAvailabilityEmail, resendReceiverAvailabilityEmail } from "@/services/orderService";
import { createShipdayOrder, deleteShipdayJobs } from "@/services/shipdayService";
import { sendOrderCancellationEmails } from "@/services/emailService";
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
import { StorageLocation } from "@/components/order-detail/StorageLocation";
import ContactDetails from "@/components/order-detail/ContactDetails";
import AdminContactEditor from "@/components/order-detail/AdminContactEditor";
import AdminTrackingEditor from "@/components/order-detail/AdminTrackingEditor";
import SchedulingButtons from "@/components/order-detail/SchedulingButtons";
import EmailResendButtons from "@/components/order-detail/EmailResendButtons";
import OrderComments from "@/components/order-detail/OrderComments";
import TimeslotSelection from "@/components/order-detail/TimeslotSelection";
import { pollOrderUpdates } from "@/services/orderService";
import { supabase } from "@/integrations/supabase/client";
import { mapDbOrderToOrderType } from "@/services/orderServiceUtils";
import { generateSingleOrderLabel } from "@/utils/labelUtils";
import { formatTimeslotWindow } from "@/utils/timeslotUtils";
import { useAuth } from "@/contexts/AuthContext";

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
  const { userProfile } = useAuth();
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

  // Reset conflicting states when switching between selection methods
  const resetPickupStates = () => {
    setSelectedPickupDate(null);
    setPickupDatePicker(undefined);
  };

  const resetDeliveryStates = () => {
    setSelectedDeliveryDate(null);
    setDeliveryDatePicker(undefined);
  };

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
      
      // Create dates at noon in local timezone to preserve the selected date
      const pickupDateOnly = new Date(pickupDateTime.getFullYear(), pickupDateTime.getMonth(), pickupDateTime.getDate(), 12, 0, 0, 0);
      
      const deliveryDateOnly = new Date(deliveryDateTime.getFullYear(), deliveryDateTime.getMonth(), deliveryDateTime.getDate(), 12, 0, 0, 0);
      
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
      
      console.log("=== SET COLLECTION DATE DEBUG ===");
      console.log("selectedPickupDate:", selectedPickupDate);
      console.log("pickupDatePicker:", pickupDatePicker);
      
      // Check for pickup date from either dropdown selection or date picker
      if (selectedPickupDate) {
        const tempDate = new Date(selectedPickupDate);
        console.log("Using selectedPickupDate, tempDate:", tempDate);
        console.log("tempDate components:", {
          year: tempDate.getFullYear(),
          month: tempDate.getMonth(),
          date: tempDate.getDate()
        });
        // Create date using local constructor to preserve the selected date
        pickupDateTime = new Date(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(), 12, 0, 0, 0);
        console.log("pickupDateTime after creation:", pickupDateTime);
      } else if (pickupDatePicker) {
        console.log("Using pickupDatePicker:", pickupDatePicker);
        console.log("pickupDatePicker components:", {
          year: pickupDatePicker.getFullYear(),
          month: pickupDatePicker.getMonth(),
          date: pickupDatePicker.getDate()
        });
        // Create date using UTC constructor to avoid timezone shifts
        pickupDateTime = new Date(pickupDatePicker.getFullYear(), pickupDatePicker.getMonth(), pickupDatePicker.getDate(), 12, 0, 0, 0);
        console.log("pickupDateTime after creation:", pickupDateTime);
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
        const tempDate = new Date(selectedDeliveryDate);
        // Create date using local constructor to preserve the selected date
        deliveryDateTime = new Date(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(), 12, 0, 0, 0);
      } else if (deliveryDatePicker) {
        // Create date using UTC constructor to avoid timezone shifts
        deliveryDateTime = new Date(deliveryDatePicker.getFullYear(), deliveryDatePicker.getMonth(), deliveryDatePicker.getDate(), 12, 0, 0, 0);
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
      
      // Create dates preserving the selected date without timezone shifts
      console.log("=== ADMIN SCHEDULE ORDER DEBUG ===");
      console.log("pickupDatePicker raw:", pickupDatePicker);
      console.log("pickupDatePicker components:", {
        year: pickupDatePicker.getFullYear(),
        month: pickupDatePicker.getMonth(),
        date: pickupDatePicker.getDate()
      });
      
      const pickupDateTime = new Date(pickupDatePicker.getFullYear(), pickupDatePicker.getMonth(), pickupDatePicker.getDate());
      console.log("pickupDateTime after creation:", pickupDateTime);
      const [pickupHours, pickupMinutes] = pickupTime.split(':').map(Number);
      pickupDateTime.setHours(pickupHours, pickupMinutes, 0);
      console.log("pickupDateTime after setting hours:", pickupDateTime);
      console.log("pickupDateTime ISO:", pickupDateTime.toISOString());
      
      console.log("deliveryDatePicker raw:", deliveryDatePicker);
      console.log("deliveryDatePicker components:", {
        year: deliveryDatePicker.getFullYear(),
        month: deliveryDatePicker.getMonth(),
        date: deliveryDatePicker.getDate()
      });
      
      const deliveryDateTime = new Date(deliveryDatePicker.getFullYear(), deliveryDatePicker.getMonth(), deliveryDatePicker.getDate());
      console.log("deliveryDateTime after creation:", deliveryDateTime);
      const [deliveryHours, deliveryMinutes] = deliveryTime.split(':').map(Number);
      deliveryDateTime.setHours(deliveryHours, deliveryMinutes, 0);
      console.log("deliveryDateTime after setting hours:", deliveryDateTime);
      console.log("deliveryDateTime ISO:", deliveryDateTime.toISOString());
      
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
      
      // Create date preserving the selected date without timezone shifts
      console.log("=== ADMIN SCHEDULE PICKUP DEBUG ===");
      console.log("pickupDatePicker raw:", pickupDatePicker);
      console.log("pickupDatePicker components:", {
        year: pickupDatePicker.getFullYear(),
        month: pickupDatePicker.getMonth(),
        date: pickupDatePicker.getDate()
      });
      
      const pickupDateTime = new Date(pickupDatePicker.getFullYear(), pickupDatePicker.getMonth(), pickupDatePicker.getDate());
      console.log("pickupDateTime after creation:", pickupDateTime);
      const [pickupHours, pickupMinutes] = pickupTime.split(':').map(Number);
      pickupDateTime.setHours(pickupHours, pickupMinutes, 0);
      console.log("pickupDateTime after setting hours:", pickupDateTime);
      console.log("pickupDateTime ISO:", pickupDateTime.toISOString());
      
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
      
      // Create date preserving the selected date without timezone shifts
      const deliveryDateTime = new Date(deliveryDatePicker.getFullYear(), deliveryDatePicker.getMonth(), deliveryDatePicker.getDate());
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
      
      // Handle cancellation with Shipday deletion and email notifications
      if (newStatus === 'cancelled') {
        let shipdaySuccess = false;
        let emailSuccess = false;
        
        // Try to delete Shipday jobs
        try {
          const shipdayResult = await deleteShipdayJobs(id);
          shipdaySuccess = shipdayResult.success;
          if (shipdaySuccess) {
            toast.success(shipdayResult.message || "Shipday jobs deleted");
          }
        } catch (shipdayError) {
          console.error("Error deleting Shipday jobs:", shipdayError);
          toast.warning("Failed to delete Shipday jobs, but continuing with cancellation");
        }
        
        // Try to send cancellation emails
        try {
          const emailResults = await sendOrderCancellationEmails(id);
          const emailsSent = Object.values(emailResults).filter(Boolean).length;
          if (emailsSent > 0) {
            emailSuccess = true;
            toast.success(`Cancellation emails sent to ${emailsSent} recipient(s)`);
          }
        } catch (emailError) {
          console.error("Error sending cancellation emails:", emailError);
          toast.warning("Failed to send some cancellation emails");
        }
        
        // Update order status to cancelled
        const updatedOrder = await updateAdminOrderStatus(id, newStatus);
        
        if (updatedOrder) {
          const mappedOrder = mapDbOrderToOrderType(updatedOrder);
          setOrder(mappedOrder);
          setSelectedStatus(newStatus);
          
          // Show comprehensive success message
          const parts = ["Order cancelled"];
          if (shipdaySuccess) parts.push("Shipday jobs deleted");
          if (emailSuccess) parts.push("notifications sent");
          toast.success(parts.join(", "));
        }
      } else {
        // Handle other status changes normally
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
          
          toast.success(`Status updated to ${newStatus}`);
        }
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
  const isAdmin = userProfile?.role === 'admin';
  
  const handleRefreshOrder = async () => {
    if (!id) return;
    try {
      const fetchedOrder = await getOrderById(id);
      if (fetchedOrder) {
        setOrder(fetchedOrder);
      }
    } catch (err) {
      console.error("Error refreshing order:", err);
    }
  };

  return (
    <Layout>
      <div className="container px-4 py-6 md:px-6 space-y-6">
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
              {/* Scheduled Dates Display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Collection Date</h3>
                  {order.scheduledPickupDate ? (
                    <div className="bg-muted p-3 rounded-md">
                      <p className="font-medium">
                        Scheduled: {safeFormat(new Date(order.scheduledPickupDate), "PPP")}
                      </p>
                      {order.pickupTimeslot && (
                        <p className="text-sm text-muted-foreground">
                          Time: {formatTimeslotWindow(order.pickupTimeslot)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-muted-foreground">No collection date scheduled</p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Delivery Date</h3>
                  {order.scheduledDeliveryDate ? (
                    <div className="bg-muted p-3 rounded-md">
                      <p className="font-medium">
                        Scheduled: {safeFormat(new Date(order.scheduledDeliveryDate), "PPP")}
                      </p>
                      {order.deliveryTimeslot && (
                        <p className="text-sm text-muted-foreground">
                          Time: {formatTimeslotWindow(order.deliveryTimeslot)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-muted-foreground">No delivery date scheduled</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sender and Receiver Selected Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Sender Availability</h3>
                  {order.pickupDate && Array.isArray(order.pickupDate) && order.pickupDate.length > 0 ? (
                    <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        {order.senderConfirmedAt ? 'Confirmed' : 'Selected'} Dates:
                      </p>
                      <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                        {order.pickupDate.map((date, index) => (
                          <div key={index}>
                            {safeFormat(new Date(date), "PPP")}
                          </div>
                        ))}
                      </div>
                      {order.senderConfirmedAt && (
                        <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">
                          Confirmed on {safeFormat(order.senderConfirmedAt, "PPP 'at' p")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-muted-foreground">No sender availability provided</p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Receiver Availability</h3>
                  {order.deliveryDate && Array.isArray(order.deliveryDate) && order.deliveryDate.length > 0 ? (
                    <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-md border border-green-200 dark:border-green-800">
                      <p className="font-medium text-green-900 dark:text-green-100">
                        {order.receiverConfirmedAt ? 'Confirmed' : 'Selected'} Dates:
                      </p>
                      <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                        {order.deliveryDate.map((date, index) => (
                          <div key={index}>
                            {safeFormat(new Date(date), "PPP")}
                          </div>
                        ))}
                      </div>
                      {order.receiverConfirmedAt && (
                        <p className="text-xs text-green-600 dark:text-green-300 mt-2">
                          Confirmed on {safeFormat(order.receiverConfirmedAt, "PPP 'at' p")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-muted-foreground">No receiver availability provided</p>
                    </div>
                  )}
                </div>
              </div>

              <SchedulingButtons
                orderId={id as string}
                onSchedulePickup={handleSchedulePickup}
                onScheduleDelivery={handleScheduleDelivery}
                onScheduleBoth={handleScheduleOrder}
                isSubmitting={isSubmitting}
                isScheduled={isScheduled}
                pickupDateSelected={!!selectedPickupDate}
                deliveryDateSelected={!!selectedDeliveryDate}
                status={order.status}
                pickupDatePicker={pickupDatePicker}
                deliveryDatePicker={deliveryDatePicker}
                setPickupDatePicker={setPickupDatePicker}
                setDeliveryDatePicker={setDeliveryDatePicker}
                pickupTime={pickupTime}
                deliveryTime={deliveryTime}
                setPickupTime={setPickupTime}
                setDeliveryTime={setDeliveryTime}
              />
              
              {/* Admin Control Buttons */}
              <div className="flex flex-col gap-2 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    onClick={() => {
                      console.log("=== SET COLLECTION DATE BUTTON CLICKED ===");
                      console.log("selectedPickupDate:", selectedPickupDate);
                      console.log("pickupDatePicker:", pickupDatePicker);
                      console.log("order.scheduledPickupDate:", order?.scheduledPickupDate);
                      handleSetCollectionDate();
                    }}
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
              <div className="space-y-6">
                <ItemDetails order={order} />
                <StorageLocation order={order} />
              </div>
              <TrackingTimeline order={order} />
            </div>
            
            <Separator className="my-6" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                {isAdmin ? (
                  <AdminContactEditor 
                    type="sender"
                    contact={order.sender}
                    notes={order.senderNotes}
                    orderId={order.id}
                    onUpdate={handleRefreshOrder}
                  />
                ) : (
                  <ContactDetails 
                    type="sender"
                    contact={order.sender}
                    notes={order.senderNotes}
                  />
                )}
                <TimeslotSelection 
                  type="sender"
                  orderId={order.id}
                  order={order}
                />
              </div>
              
              <div className="space-y-4">
                {isAdmin ? (
                  <AdminContactEditor 
                    type="receiver"
                    contact={order.receiver}
                    notes={order.receiverNotes}
                    orderId={order.id}
                    onUpdate={handleRefreshOrder}
                  />
                ) : (
                  <ContactDetails 
                    type="receiver"
                    contact={order.receiver}
                    notes={order.receiverNotes}
                  />
                )}
                <TimeslotSelection 
                  type="receiver"
                  orderId={order.id}
                  order={order}
                />
              </div>
            </div>
            
            {isAdmin && (
              <>
                <Separator className="my-6" />
                <AdminTrackingEditor order={order} onUpdate={handleRefreshOrder} />
              </>
            )}
            
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
