
import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPublicOrder } from "@/services/fetchOrderService";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TrackingTimeline from "@/components/order-detail/TrackingTimeline";
import { ArrowLeft, Package } from "lucide-react";
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
                  <Input placeholder="Enter your order ID" {...field} />
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

  const handleSearch = (orderId: string) => {
    navigate(`/tracking/${orderId}`);
    setSearchId(orderId);
  };

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['publicOrder', searchId],
    queryFn: () => searchId ? getPublicOrder(searchId) : Promise.resolve(null),
    enabled: !!searchId,
  });

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
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-6">
                <div>
                  <h2 className="text-xl font-semibold flex items-center">
                    <Package className="mr-2 h-5 w-5 text-courier-500" />
                    Order #{order.id.substring(0, 8)}
                  </h2>
                  <p className="text-muted-foreground">Created on {new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                
                <div className="border-t pt-4">
                  <TrackingTimeline order={order} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && searchId && !order && (
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
