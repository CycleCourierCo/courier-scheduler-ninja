
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, AlertCircle, CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, isBefore } from "date-fns";
import { updateReceiverAvailability } from '@/services/orderService';

export default function ReceiverAvailability() {
  const { id } = useParams<{ id: string }>();
  const [dates, setDates] = useState<Date[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  // Define minimum date based on pickup date(s)
  const [minDate, setMinDate] = useState<Date>(addDays(new Date(), 2));

  useEffect(() => {
    async function fetchOrder() {
      try {
        if (!id) {
          console.error("Order ID is missing from URL params");
          setError("Order ID is missing");
          setIsLoading(false);
          return;
        }

        console.log(`Fetching order with ID: ${id}`);
        
        // With the public access policy, we can directly fetch the order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', id)
          .maybeSingle(); // Use maybeSingle instead of single
        
        if (orderError) {
          console.error("Error fetching order directly:", orderError);
          setError("Failed to load order details. Please try again later.");
          setIsLoading(false);
          return;
        }
        
        if (!orderData) {
          console.error(`Order not found with ID: ${id}`);
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
        
        // Calculate minimum date based on pickup date
        if (formattedOrder.pickupDate) {
          if (Array.isArray(formattedOrder.pickupDate) && formattedOrder.pickupDate.length > 0) {
            // Find the earliest pickup date
            const earliestDate = new Date(Math.min(...formattedOrder.pickupDate.map(d => d.getTime())));
            setMinDate(earliestDate);
          } else if (!Array.isArray(formattedOrder.pickupDate)) {
            setMinDate(formattedOrder.pickupDate);
          }
        }
        
        // If the order already has a delivery date or status is beyond receiver_availability_pending,
        // it means the receiver has already confirmed their availability
        if (orderData.delivery_date || 
            (orderData.status !== 'receiver_availability_pending' && 
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
  }, [id]);

  const handleSubmit = async () => {
    if (dates.length === 0) {
      toast.error("Please select at least one date for delivery");
      return;
    }

    if (!id) {
      toast.error("Order ID is missing");
      return;
    }

    try {
      console.log("Starting submission with dates:", dates);
      setIsSubmitting(true);
      
      // Use the service function to update receiver availability
      const result = await updateReceiverAvailability(id, dates);
      console.log("Update result:", result);
      
      if (!result) {
        toast.error("Failed to confirm your availability. Please try again.");
        setIsSubmitting(false);
        return;
      }
      
      toast.success("Your availability has been confirmed");
      // Show confirmation page
      setError("availability_confirmed");
      setIsSubmitting(false);
    } catch (err) {
      console.error("Error updating receiver availability:", err);
      // More detailed error message
      let errorMessage = "Failed to confirm your availability";
      if (err instanceof Error) {
        errorMessage += `: ${err.message}`;
      } else if (typeof err === 'object' && err !== null) {
        const errorObj = err as any;
        if (errorObj.message) {
          errorMessage += `: ${errorObj.message}`;
        }
        // If it's a database error with a code
        if (errorObj.code) {
          errorMessage += ` (Error code: ${errorObj.code})`;
        }
      }
      toast.error(errorMessage);
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
                : error === "availability_confirmed"
                ? "Availability Confirmed Successfully"
                : "Error"}
              {error !== "already_confirmed" && error !== "availability_confirmed" && (
                <AlertCircle className="ml-2 h-5 w-5 text-destructive" />
              )}
            </CardTitle>
            <CardDescription>
              {error === "already_confirmed"
                ? "Thank you for confirming your availability. We have already received your time preference."
                : error === "availability_confirmed"
                ? "Thank you for confirming your availability. Your delivery will be scheduled based on your preferences."
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
            Select dates when you will be available for package delivery (must be after the sender's availability)
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
