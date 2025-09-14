
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPublicOrder } from "@/services/fetchOrderService";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TrackingTimeline from "@/components/order-detail/TrackingTimeline";
import { ArrowLeft, Package, Calendar, Bike, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

const formSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
});

const TrackingForm = ({ onSearch }: { onSearch: (orderId: string) => void }) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orderId: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    onSearch(values.orderId);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="orderId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Enter Order ID</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <Input placeholder="Enter your order ID (e.g., CCC754...)" {...field} />
                </FormControl>
                <Button type="submit" className="bg-courier-500 hover:bg-courier-600">
                  Track
                </Button>
              </div>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};

const TrackingPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchId, setSearchId] = useState<string | undefined>(id);
  // Track whether we've attempted to load the order
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  // Set searchId when id param changes
  useEffect(() => {
    if (id) {
      setSearchId(id);
      setHasAttemptedLoad(false); // Reset when ID changes
    }
  }, [id]);

  const handleSearch = (orderId: string) => {
    navigate(`/tracking/${orderId}`);
    setSearchId(orderId);
    setHasAttemptedLoad(false); // Reset when manually searching
  };

  const { data: order, isLoading, error, isSuccess } = useQuery({
    queryKey: ['publicOrder', searchId],
    queryFn: () => {
      console.log("Fetching order with ID:", searchId);
      if (searchId) {
        setHasAttemptedLoad(true);
        return getPublicOrder(searchId);
      }
      return Promise.resolve(null);
    },
    enabled: !!searchId,
  });

  // Debug logs
  console.log("TrackingPage order data:", order);
  console.log("TrackingPage order tracking:", order?.trackingEvents);
  console.log("HasAttemptedLoad:", hasAttemptedLoad, "isSuccess:", isSuccess);

  return (
    <Layout>
      <div className="container py-8">
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          <h1 className="text-2xl font-bold mb-6">Track Your Order</h1>
          
          <Card className="mb-8">
            <CardContent className="pt-6">
              <TrackingForm onSearch={handleSearch} />
            </CardContent>
          </Card>
        </div>

        {isLoading && (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto mb-4 text-courier-500 animate-pulse" />
            <p>Loading order information...</p>
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6 text-center py-8">
              <p className="text-red-600">Error loading order. Please check the order ID and try again.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && order && (
          <div className="space-y-6">
            {/* Order Header with Scheduled Dates and Bike Details */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-xl font-semibold flex items-center">
                        <Package className="mr-2 h-5 w-5 text-courier-500" />
                        {order.customerOrderNumber ? (
                          `Order #${order.customerOrderNumber}`
                        ) : (
                          `Order #${order.trackingNumber || order.id.substring(0, 8)}`
                        )}
                      </h2>
                      <p className="text-muted-foreground">Created on {new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    
                    {/* Bike Details */}
                    {(order.bikeBrand || order.bikeModel) && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Bike className="mr-2 h-4 w-4" />
                        <span>
                          {order.bikeBrand} {order.bikeModel}
                          {order.bikeQuantity && order.bikeQuantity > 1 && (
                            <span className="ml-1">(×{order.bikeQuantity})</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Scheduled Dates Section */}
                  {(order.scheduledPickupDate || order.scheduledDeliveryDate) && (
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-medium mb-3 flex items-center">
                        <Calendar className="mr-2 h-4 w-4 text-courier-500" />
                        Scheduled Dates
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {order.scheduledPickupDate && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm font-medium text-blue-900">Collection Date</p>
                            <div className="flex items-center text-blue-700 mb-2">
                              <Calendar className="w-4 h-4 mr-2" />
                              {new Date(order.scheduledPickupDate).toLocaleDateString('en-GB', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </div>
                            {order.pickupTimeslot && (
                              <div className="flex items-center text-blue-600">
                                <Clock className="w-4 h-4 mr-2" />
                                <span className="text-sm">Timeslot: {order.pickupTimeslot}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {order.scheduledDeliveryDate && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-sm font-medium text-green-900">Delivery Date</p>
                            <div className="flex items-center text-green-700 mb-2">
                              <Calendar className="w-4 h-4 mr-2" />
                              {new Date(order.scheduledDeliveryDate).toLocaleDateString('en-GB', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </div>
                            {order.deliveryTimeslot && (
                              <div className="flex items-center text-green-600">
                                <Clock className="w-4 h-4 mr-2" />
                                <span className="text-sm">Timeslot: {order.deliveryTimeslot}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-3 italic">
                        * These dates are provisional. You will receive a 3-hour timeslot when an exact date is scheduled in.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tracking Timeline */}
            <Card>
              <CardContent className="pt-6">
                <TrackingTimeline order={order} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Only show the "not found" message after we've attempted to load the order and it wasn't found */}
        {!isLoading && !error && hasAttemptedLoad && searchId && !order && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6 text-center py-8">
              <p className="text-yellow-700">No order found with this ID. Please check the order ID and try again.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default TrackingPage;
