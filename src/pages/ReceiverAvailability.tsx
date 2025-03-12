
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, isBefore } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2 } from "lucide-react";
import { getOrderById, updateReceiverAvailability } from "@/services/orderService";

const schema = z.object({
  deliveryDates: z.array(z.date()).min(1, "Please select at least one delivery date.")
});

type FormValues = z.infer<typeof schema>;

const ReceiverAvailability = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      deliveryDates: [],
    },
  });

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => {
      if (!orderId) {
        throw new Error("Order ID is required");
      }
      console.log("Fetching order with ID:", orderId);
      return getOrderById(orderId);
    },
    enabled: !!orderId,
  });

  const onSubmit = async (data: FormValues) => {
    try {
      if (!orderId) {
        toast.error("Order ID is missing");
        return;
      }
      
      console.log("Submitting availability for order:", orderId, data.deliveryDates);
      await updateReceiverAvailability(orderId, data.deliveryDates);
      toast.success("Availability confirmed successfully!");
      navigate("/confirmation", { 
        state: { 
          message: "Thank you for confirming your availability!",
          details: "Your delivery has been scheduled. You'll receive tracking information shortly."
        } 
      });
    } catch (error) {
      console.error("Error confirming availability:", error);
      toast.error("Failed to confirm availability. Please try again.");
    }
  };

  // Handle case when orderId is not available
  if (!orderId) {
    console.log("No order ID provided");
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              No order ID was provided. Please check the URL and try again.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => navigate("/")} className="w-full">
              Go Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    console.log("Loading order data...");
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !order || !order.pickupDate) {
    console.error("Error loading order:", error);
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
            <CardDescription>
              We couldn't find the order you're looking for. It may have been cancelled or doesn't exist.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => navigate("/")} className="w-full">
              Return Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  console.log("Order data loaded:", order);

  // Get the earliest pickup date if there are multiple
  const earliestPickupDate = Array.isArray(order.pickupDate) && order.pickupDate.length > 0
    ? new Date(Math.min(...order.pickupDate.map(d => d instanceof Date ? d.getTime() : new Date(d).getTime())))
    : order.pickupDate instanceof Date 
      ? order.pickupDate 
      : new Date();

  return (
    <div className="flex min-h-screen bg-gray-50 items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-courier-800">Confirm Delivery Availability</CardTitle>
          <CardDescription>
            Hi {order.receiver?.name || "Receiver"}, please select dates when you'll be available to receive the package.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <div className="font-medium">Order Details:</div>
                <div className="text-sm text-gray-500">
                  <div><span className="font-semibold">From:</span> {order.sender?.address?.city || "N/A"}, {order.sender?.address?.state || "N/A"}</div>
                  <div><span className="font-semibold">To:</span> {order.receiver?.address?.city || "N/A"}, {order.receiver?.address?.state || "N/A"}</div>
                  <div><span className="font-semibold">Sender's Availability:</span> {Array.isArray(order.pickupDate) 
                    ? order.pickupDate.map(d => format(new Date(d), "PPP")).join(", ")
                    : format(new Date(order.pickupDate), "PPP")
                  }</div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="deliveryDates"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Delivery Dates</FormLabel>
                    <div className="rounded-md border p-4">
                      <Calendar
                        mode="multiple"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => isBefore(date, earliestPickupDate)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </div>
                    <FormDescription>
                      Please select dates when you'll be available for delivery (must be after the earliest sender's availability date: {format(earliestPickupDate, "PPP")}).
                    </FormDescription>
                    <FormMessage />
                    
                    {field.value.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-sm font-medium mb-2">Selected dates:</h3>
                        <ul className="space-y-1">
                          {field.value.sort((a, b) => a.getTime() - b.getTime()).map((date, index) => (
                            <li key={index} className="flex items-center text-sm">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              <span>{format(date, "EEEE, MMMM do, yyyy")}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full bg-courier-600 hover:bg-courier-700"
                disabled={!form.formState.isValid}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  "Confirm Availability"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReceiverAvailability;
