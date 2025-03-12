
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { getOrderById, updateSenderAvailability } from '@/services/orderService';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, AlertCircle, CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, isBefore } from "date-fns";
import { Json } from '@/integrations/supabase/types';

export default function SenderAvailability() {
  const { orderId } = useParams<{ orderId: string }>();
  const [dates, setDates] = useState<Date[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // Define minimum date (2 days from now)
  const minDate = addDays(new Date(), 2);

  useEffect(() => {
    async function fetchOrder() {
      try {
        if (!orderId) {
          setError("Order ID is missing");
          setIsLoading(false);
          return;
        }

        console.log(`Fetching order with ID: ${orderId}`);
        
        // With the new public access policy, we can directly fetch the order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
        
        if (orderError) {
          console.error("Error fetching order directly:", orderError);
          setError("Failed to load order details. Please try again later.");
          setIsLoading(false);
          return;
        }
        
        if (!orderData) {
          console.error(`Order not found with ID: ${orderId}`);
          setError("Order not found. The link might be invalid or the order has been deleted.");
          setIsLoading(false);
          return;
        }

        console.log("Order data:", orderData);
        
        // Convert the order data to our expected format
        const formattedOrder = {
          id: orderData.id,
          sender: orderData.sender,
          receiver: orderData.receiver,
          status: orderData.status,
          createdAt: new Date(orderData.created_at),
          updatedAt: new Date(orderData.updated_at),
          pickupDate: orderData.pickup_date ? 
            Array.isArray(orderData.pickup_date) ?
              orderData.pickup_date.map((d: string) => new Date(d)) :
              new Date(orderData.pickup_date as string)
            : undefined,
          deliveryDate: orderData.delivery_date ?
            Array.isArray(orderData.delivery_date) ?
              orderData.delivery_date.map((d: string) => new Date(d)) :
              new Date(orderData.delivery_date as string)
            : undefined,
          trackingNumber: orderData.tracking_number
        };
        
        setOrder(formattedOrder);
        
        // If the order already has a pickup date or status is beyond sender_availability_pending,
        // it means the sender has already confirmed their availability
        if (orderData.pickup_date || 
            (orderData.status !== 'sender_availability_pending' && 
             orderData.status !== 'created')) {
          setError("already_confirmed");
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching order:", err);
        setError("Failed to load order details. Please try again later.");
        setIsLoading(false);
      }
    }

    fetchOrder();
  }, [orderId]);

  const handleSubmit = async () => {
    if (dates.length === 0) {
      toast.error("Please select at least one date for pickup");
      return;
    }

    if (!orderId) {
      toast.error("Order ID is missing");
      return;
    }

    try {
      setIsSubmitting(true);
      // Sort dates chronologically
      const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
      await updateSenderAvailability(orderId, sortedDates);
      toast.success("Your availability has been confirmed");
      // Redirect to a confirmation page or display a success message
      navigate("/");
    } catch (err) {
      console.error("Error updating sender availability:", err);
      toast.error("Failed to confirm your availability");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading order details...</span>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center">
              {error === "already_confirmed" 
                ? "Availability Already Confirmed" 
                : "Error"}
              {error !== "already_confirmed" && (
                <AlertCircle className="ml-2 h-5 w-5 text-destructive" />
              )}
            </CardTitle>
            <CardDescription>
              {error === "already_confirmed"
                ? "Thank you for confirming your availability. We have already received your time preference."
                : error}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => navigate("/")} className="w-full">
              Return to Home
            </Button>
          </CardFooter>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Confirm Your Availability</CardTitle>
          <CardDescription>
            Select dates when you will be available for package pickup (minimum 2 days from now)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center">
            <Calendar
              mode="multiple"
              selected={dates}
              onSelect={setDates}
              className="rounded-md border pointer-events-auto"
              disabled={(date) => isBefore(date, minDate)}
            />
            <div className="mt-4 w-full">
              <h3 className="font-medium mb-2">Selected dates:</h3>
              {dates.length > 0 ? (
                <ul className="space-y-1">
                  {dates.sort((a, b) => a.getTime() - b.getTime()).map((date, index) => (
                    <li key={index} className="flex items-center">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      <span>{format(date, "EEEE, MMMM do, yyyy")}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No dates selected</p>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button 
            onClick={handleSubmit} 
            disabled={dates.length === 0 || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                Confirming...
              </>
            ) : (
              "Confirm Availability"
            )}
          </Button>
        </CardFooter>
      </Card>
    </Layout>
  );
}
