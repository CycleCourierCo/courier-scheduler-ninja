
import React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Layout from "@/components/Layout";
import ContactForm from "@/components/ContactForm";
import AddressForm from "@/components/AddressForm";
import { createOrder } from "@/services/orderService";
import { CreateOrderFormData } from "@/types/order";

// Define regex patterns for validation
const UK_PHONE_REGEX = /^\+44[0-9]{10}$/; // Validates +44 followed by 10 digits
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const orderSchema = z.object({
  sender: z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().regex(EMAIL_REGEX, "Invalid email format"),
    phone: z.string().regex(UK_PHONE_REGEX, "Phone must be in format +44XXXXXXXXXX"),
    address: z.object({
      street: z.string().min(2, "Street address is required"),
      city: z.string().min(2, "City is required"),
      state: z.string().min(1, "State is required"),
      zipCode: z.string().min(1, "Zip code is required"),
      country: z.string().min(2, "Country is required"),
    }),
  }),
  receiver: z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().regex(EMAIL_REGEX, "Invalid email format"),
    phone: z.string().regex(UK_PHONE_REGEX, "Phone must be in format +44XXXXXXXXXX"),
    address: z.object({
      street: z.string().min(2, "Street address is required"),
      city: z.string().min(2, "City is required"),
      state: z.string().min(1, "State is required"),
      zipCode: z.string().min(1, "Zip code is required"),
      country: z.string().min(2, "Country is required"),
    }),
  }),
  bikeBrand: z.string().min(1, "Bike brand is required"),
  bikeModel: z.string().min(1, "Bike model is required"),
  customerOrderNumber: z.string().optional(),
  needsPaymentOnCollection: z.boolean().default(false),
  isBikeSwap: z.boolean().default(false),
  deliveryInstructions: z.string().min(1, "Delivery instructions are required"),
});

const CreateOrder = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState("details"); // Changed default tab to details
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CreateOrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      sender: {
        name: "",
        email: "",
        phone: "+44", // Pre-populate with +44 prefix
        address: {
          street: "",
          city: "",
          state: "",
          zipCode: "",
          country: "",
        },
      },
      receiver: {
        name: "",
        email: "",
        phone: "+44", // Pre-populate with +44 prefix
        address: {
          street: "",
          city: "",
          state: "",
          zipCode: "",
          country: "",
        },
      },
      bikeBrand: "",
      bikeModel: "",
      customerOrderNumber: "",
      needsPaymentOnCollection: false,
      isBikeSwap: false,
      deliveryInstructions: "",
    },
  });

  const onSubmit = async (data: CreateOrderFormData) => {
    setIsSubmitting(true);
    try {
      const order = await createOrder(data);
      toast.success("Order created successfully!");
      navigate(`/dashboard`);
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Failed to create order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-courier-800 mb-6">Create New Order</h1>
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
            <CardDescription>
              Enter the order information to create a new courier order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="details">Order Details</TabsTrigger>
                    <TabsTrigger value="sender">Collection Information</TabsTrigger>
                    <TabsTrigger value="receiver">Delivery Information</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Bike Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="bikeBrand"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bike Brand *</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Trek, Specialized" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bikeModel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bike Model *</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Domane SL5, Stumpjumper" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="mt-4">
                        <FormField
                          control={form.control}
                          name="customerOrderNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Customer Order Number (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Order reference number if applicable" {...field} />
                              </FormControl>
                              <FormDescription>
                                If you have an existing order number or reference, enter it here.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-4">Order Options</h3>
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="needsPaymentOnCollection"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                  Payment Required on Collection
                                </FormLabel>
                                <FormDescription>
                                  Toggle if payment needs to be collected when the bike is picked up.
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="isBikeSwap"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                  Bike Swap
                                </FormLabel>
                                <FormDescription>
                                  Toggle if this order is a bike swap (exchanging one bike for another).
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-4">Delivery Instructions</h3>
                      <FormField
                        control={form.control}
                        name="deliveryInstructions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Special Instructions *</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Please provide any special instructions for pickup or delivery"
                                className="min-h-[100px]"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        type="button" 
                        onClick={() => setActiveTab("sender")}
                        className="bg-courier-600 hover:bg-courier-700"
                      >
                        Next: Collection Information
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="sender" className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Collection Contact Information</h3>
                      <ContactForm control={form.control} prefix="sender" />
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-4">Collection Address</h3>
                      <AddressForm control={form.control} prefix="sender.address" />
                    </div>

                    <div className="flex justify-between">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setActiveTab("details")}
                      >
                        Back to Order Details
                      </Button>
                      <Button 
                        type="button" 
                        onClick={() => setActiveTab("receiver")}
                        className="bg-courier-600 hover:bg-courier-700"
                      >
                        Next: Delivery Information
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="receiver" className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Delivery Contact Information</h3>
                      <ContactForm control={form.control} prefix="receiver" />
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-4">Delivery Address</h3>
                      <AddressForm control={form.control} prefix="receiver.address" />
                    </div>

                    <div className="flex justify-between">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setActiveTab("sender")}
                      >
                        Back to Collection Information
                      </Button>
                      <Button 
                        type="submit" 
                        className="bg-courier-600 hover:bg-courier-700"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Creating Order..." : "Create Order"}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CreateOrder;
