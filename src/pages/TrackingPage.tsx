import { isOutboundNi } from "@/utils/niDelivery";

import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPublicOrder } from "@/services/fetchOrderService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TrackingTimeline from "@/components/order-detail/TrackingTimeline";
import { Package, Calendar, Bike, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { formatTimeslotWindow } from "@/utils/timeslotUtils";
import type { Order } from "@/types/order";
import DoorstepShell from "@/components/design/DoorstepShell";
import Layout from "@/components/Layout";


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
                <Button type="submit">
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
  const queryClient = useQueryClient();
  const [searchId, setSearchId] = useState<string | undefined>(id);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  useEffect(() => {
    if (id) {
      setSearchId(id);
      setHasAttemptedLoad(false);
    }
  }, [id]);

  const handleSearch = (orderId: string) => {
    navigate(`/tracking/${orderId}`);
    setSearchId(orderId);
    setHasAttemptedLoad(false);
  };

  const { data: order, isLoading, error, isSuccess } = useQuery({
    queryKey: ['publicOrder', searchId],
    queryFn: () => {
      if (searchId) {
        setHasAttemptedLoad(true);
        return getPublicOrder(searchId);
      }
      return Promise.resolve(null);
    },
    enabled: !!searchId,
  });

  // After a successful postcode verification the timeline gets a more
  // revealing payload — swap it into the react-query cache so re-renders
  // keep the unlocked POD/signature URLs.
  const handleOrderUpdated = (next: Order) => {
    queryClient.setQueryData(['publicOrder', searchId], next);
  };



  return (
    <Layout>
      <DoorstepShell title="Track your bike" reference={order?.trackingNumber ?? searchId}>
          {!order && <Card className="mb-8">
            <CardContent className="pt-6">
              <TrackingForm onSearch={handleSearch} />
            </CardContent>
          </Card>}

        {isLoading && (
          <div className="text-center py-8">
            <Package className="mx-auto mb-4 h-12 w-12 animate-pulse text-primary" />
            <p>Loading order information...</p>
          </div>
        )}

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6 text-center py-8">
              <p className="text-destructive">We couldn't load this order. Check the order ID and try again.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && order && (
          <div className="space-y-6">
            {/* Order Header with Scheduled Dates and Bike Details */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-6 min-w-0">
                  <div className="flex flex-col gap-4 min-w-0">
                    <div className="min-w-0 overflow-hidden">
                      <h2 className="text-lg sm:text-xl font-semibold flex items-start gap-2 mb-2">
                         <Package className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <span className="break-all text-sm sm:text-base leading-tight">
                          {order.customerOrderNumber ? (
                            `Order #${order.customerOrderNumber}`
                          ) : (
                            `Order #${order.trackingNumber || order.id.substring(0, 8)}`
                          )}
                        </span>
                      </h2>
                      <p className="text-muted-foreground text-sm break-words">Created on {new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    
                    {/* Bike Details */}
                    {(order.bikeBrand || order.bikeModel) && (
                      <div className="flex items-start text-sm text-muted-foreground gap-2 min-w-0 overflow-hidden">
                        <Bike className="h-4 w-4 mt-0.5 shrink-0" />
                        <span className="min-w-0 flex-1 break-words leading-tight">
                          {order.bikeBrand} {order.bikeModel}
                          {order.bikeQuantity && order.bikeQuantity > 1 && (
                            <span className="ml-1">(×{order.bikeQuantity})</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Scheduled Dates Section */}
                  {(order.scheduledPickupDate || (order.scheduledDeliveryDate && !isOutboundNi(order))) && (
                    <div className="border-t pt-4 min-w-0">
                      <h3 className="text-sm font-medium mb-3 flex items-center">
                        <Calendar className="mr-2 h-4 w-4 text-courier-500 shrink-0" />
                        Scheduled Dates
                      </h3>
                   <div className="space-y-4 min-w-0">
                     {order.scheduledPickupDate && (
                        <div className="min-w-0 overflow-hidden rounded-md border bg-secondary p-3 sm:p-4">
                          <p className="mb-2 text-sm font-bold">Collection</p>
                          <div className="data-text mb-2 flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
                           <div className="flex items-start gap-2 min-w-0">
                             <Calendar className="w-4 h-4 mt-0.5 shrink-0" />
                             <span className="text-xs sm:text-sm break-words leading-tight">
                               {window.innerWidth < 640 ? 
                                 new Date(order.scheduledPickupDate).toLocaleDateString('en-GB', {
                                   weekday: 'short',
                                   day: 'numeric',
                                   month: 'short',
                                   year: '2-digit'
                                 }) :
                                 new Date(order.scheduledPickupDate).toLocaleDateString('en-GB', {
                                   weekday: 'long',
                                   year: 'numeric',
                                   month: 'long',
                                   day: 'numeric'
                                 })
                               }
                             </span>
                           </div>
                         </div>
                         {order.pickupTimeslot && (
                            <div className="data-text flex min-w-0 items-start gap-2">
                             <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                              <span className="text-xs sm:text-sm break-words leading-tight">Timeslot: {formatTimeslotWindow(order.pickupTimeslot)}</span>
                           </div>
                         )}
                       </div>
                     )}
                     
                     {isOutboundNi(order) ? (
                        <div className="min-w-0 overflow-hidden rounded-md border bg-muted p-3 sm:p-4">
                          <p className="mb-2 text-sm font-bold">Delivery</p>
                          <p className="text-sm leading-tight">
                           To be confirmed — your bike travels onward by ferry once it reaches the ferry port.
                         </p>
                       </div>
                     ) : order.scheduledDeliveryDate && (
                        <div className="min-w-0 overflow-hidden rounded-md border bg-secondary p-3 sm:p-4">
                          <p className="mb-2 text-sm font-bold">Delivery</p>
                          <div className="data-text mb-2 flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
                           <div className="flex items-start gap-2 min-w-0">
                             <Calendar className="w-4 h-4 mt-0.5 shrink-0" />
                             <span className="text-xs sm:text-sm break-words leading-tight">
                               {window.innerWidth < 640 ? 
                                 new Date(order.scheduledDeliveryDate).toLocaleDateString('en-GB', {
                                   weekday: 'short',
                                   day: 'numeric',
                                   month: 'short',
                                   year: '2-digit'
                                 }) :
                                 new Date(order.scheduledDeliveryDate).toLocaleDateString('en-GB', {
                                   weekday: 'long',
                                   year: 'numeric',
                                   month: 'long',
                                   day: 'numeric'
                                 })
                               }
                             </span>
                           </div>
                         </div>
                         {order.deliveryTimeslot && (
                            <div className="data-text flex min-w-0 items-start gap-2">
                             <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                              <span className="text-xs sm:text-sm break-words leading-tight">Timeslot: {formatTimeslotWindow(order.deliveryTimeslot)}</span>
                           </div>
                         )}
                       </div>
                     )}
                       </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-3 italic break-words leading-snug">
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
                <TrackingTimeline order={order} orderIdentifier={searchId} onOrderUpdated={handleOrderUpdated} />
              </CardContent>
            </Card>

          </div>
        )}

        {/* Only show the "not found" message after we've attempted to load the order and it wasn't found */}
        {!isLoading && !error && hasAttemptedLoad && searchId && !order && (
           <Card className="chevron-tape">
            <CardContent className="pt-6 text-center py-8">
               <p>No order found with this ID. Check the order ID and try again.</p>
            </CardContent>
          </Card>
        )}
      </DoorstepShell>
    </Layout>
  );
};

export default TrackingPage;
