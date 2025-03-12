
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
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
import { CalendarIcon, CheckCircle2 } from "lucide-react";
import { getOrderById, updateSenderAvailability } from "@/services/orderService";

const schema = z.object({
  pickupDate: z.date({
    required_error: "Please select a pickup date.",
  })
});

type FormValues = z.infer<typeof schema>;

const SenderAvailability = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  if (!orderId) {
    navigate("/dashboard");
    return null;
  }

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrderById(orderId),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      pickupDate: undefined,
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await updateSenderAvailability(orderId, data.pickupDate);
      toast.success("Availability confirmed successfully!");
      navigate("/confirmation", { 
        state: { 
          message: "Thank you for confirming your availability!",
          details: "The receiver will be notified to schedule their availability. You will receive a confirmation once the delivery is scheduled."
        } 
      });
    } catch (error) {
      console.error("Error confirming availability:", error);
      toast.error("Failed to confirm availability. Please try again.");
    }
  };

  const minDate = addDays(new Date(), 2);
  
  // Check if the availability has already been confirmed (status is no longer sender_availability_pending)
  const isAlreadyConfirmed = order && order.status !== 'sender_availability_pending';

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
            <CardDescription>
              We couldn't find the order you're looking for. It may have been cancelled or doesn't exist.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              Return to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // If already confirmed, show thank you message
  if (isAlreadyConfirmed) {
    return (
      <div className="flex min-h-screen bg-gray-50 items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl text-courier-800">Thank You!</CardTitle>
            <CardDescription className="text-lg mt-4">
              You have already confirmed your availability for this order.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              The pickup date you selected is: {order.pickupDate ? format(order.pickupDate, "PPP") : "Not specified"}
            </p>
            <p className="text-gray-600">
              The receiver will be notified to schedule their availability. You will receive a confirmation once the delivery is scheduled.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => navigate("/dashboard")} className="w-full bg-courier-600 hover:bg-courier-700">
              Return to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-courier-800">Confirm Pickup Availability</CardTitle>
          <CardDescription>
            Hi {order.sender.name}, please select a date when you'll be available for package pickup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <div className="font-medium">Order Details:</div>
                <div className="text-sm text-gray-500">
                  <div><span className="font-semibold">From:</span> {order.sender.address.city}, {order.sender.address.state}</div>
                  <div><span className="font-semibold">To:</span> {order.receiver.address.city}, {order.receiver.address.state}</div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="pickupDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Pickup Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Select a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < minDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Please select a date at least 2 days from today.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full bg-courier-600 hover:bg-courier-700"
                disabled={!form.formState.isValid}
              >
                Confirm Availability
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SenderAvailability;
