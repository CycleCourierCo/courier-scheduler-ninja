
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
import { CalendarIcon } from "lucide-react";
import { getOrderById, updateReceiverAvailability } from "@/services/orderService";

const schema = z.object({
  deliveryDate: z.date({
    required_error: "Please select a delivery date.",
  })
});

type FormValues = z.infer<typeof schema>;

const ReceiverAvailability = () => {
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
      deliveryDate: undefined,
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await updateReceiverAvailability(orderId, data.deliveryDate);
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !order || !order.pickupDate) {
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

  const minDate = addDays(new Date(order.pickupDate), 1);

  return (
    <div className="flex min-h-screen bg-gray-50 items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-courier-800">Confirm Delivery Availability</CardTitle>
          <CardDescription>
            Hi {order.receiver.name}, please select a date when you'll be available to receive the package.
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
                  <div><span className="font-semibold">Sender's Availability:</span> {format(new Date(order.pickupDate), "PPP")}</div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="deliveryDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Delivery Date</FormLabel>
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
                      Please select a date at least 1 day after the sender's availability ({format(new Date(order.pickupDate), "PPP")}).
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

export default ReceiverAvailability;
