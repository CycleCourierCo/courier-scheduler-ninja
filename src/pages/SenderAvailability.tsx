
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { getOrderById, updateSenderAvailability } from '@/services/orderService';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';

export default function SenderAvailability() {
  const { orderId } = useParams<{ orderId: string }>();
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchOrder() {
      try {
        if (!orderId) {
          setError("Order ID is missing");
          setIsLoading(false);
          return;
        }

        console.log(`Fetching order with ID: ${orderId}`);
        
        // Make a direct check to Supabase to see if the order exists
        // This can help us debug if there's an issue with the database query
        try {
          const response = await fetch(
            `https://axigtrmaxhetyfzjjdve.supabase.co/rest/v1/orders?id=eq.${orderId}&select=id`, 
            {
              headers: {
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4aWd0cm1heGhldHlmempqZHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3NDA4MDMsImV4cCI6MjA1NzMxNjgwM30.POm5myoyMwKjkMfYMw2gRFs-cgD7GDznv338qiadugg'
              }
            }
          );
          const data = await response.json();
          console.log('Direct Supabase REST API check result:', data);
        } catch (directCheckError) {
          console.error('Error with direct check:', directCheckError);
        }
        
        const orderData = await getOrderById(orderId);
        
        if (!orderData) {
          console.error(`Order not found with ID: ${orderId}`);
          setError("Order not found. The link might be invalid or the order has been deleted.");
          setIsLoading(false);
          return;
        }

        console.log("Order data:", orderData);
        setOrder(orderData);
        
        // If the order already has a pickup date or status is beyond sender_availability_pending,
        // it means the sender has already confirmed their availability
        if (orderData.pickupDate || 
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
    if (!date) {
      toast.error("Please select a date for pickup");
      return;
    }

    if (!orderId) {
      toast.error("Order ID is missing");
      return;
    }

    try {
      setIsSubmitting(true);
      await updateSenderAvailability(orderId, date);
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
            Select a date when you will be available for package pickup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            />
            <p className="mt-2 text-sm text-gray-500">
              {date ? `Selected date: ${date.toLocaleDateString()}` : "No date selected"}
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button 
            onClick={handleSubmit} 
            disabled={!date || isSubmitting}
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
