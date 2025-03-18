
import React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Layout from "@/components/Layout";
import ContactForm from "@/components/ContactForm";
import AddressForm from "@/components/AddressForm";
import { createOrder } from "@/services/orderService";
import { CreateOrderFormData } from "@/types/order";

const orderSchema = z.object({
  sender: z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(5, "Phone number is required"),
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
    email: z.string().email("Invalid email address"),
    phone: z.string().min(5, "Phone number is required"),
    address: z.object({
      street: z.string().min(2, "Street address is required"),
      city: z.string().min(2, "City is required"),
      state: z.string().min(1, "State is required"),
      zipCode: z.string().min(1, "Zip code is required"),
      country: z.string().min(2, "Country is required"),
    }),
  }),
});

const CreateOrder = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState("sender");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CreateOrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      sender: {
        name: "",
        email: "",
        phone: "",
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
        phone: "",
        address: {
          street: "",
          city: "",
          state: "",
          zipCode: "",
          country: "",
        },
      },
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
              Enter the sender and receiver information to create a new courier order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="sender">Sender Information</TabsTrigger>
                    <TabsTrigger value="receiver">Receiver Information</TabsTrigger>
                  </TabsList>

                  <TabsContent value="sender" className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Contact Information</h3>
                      <ContactForm control={form.control} prefix="sender" />
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-4">Pickup Address</h3>
                      <AddressForm control={form.control} prefix="sender.address" />
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        type="button" 
                        onClick={() => setActiveTab("receiver")}
                        className="bg-courier-600 hover:bg-courier-700"
                      >
                        Next: Receiver Information
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="receiver" className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Contact Information</h3>
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
                        Back to Sender Information
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
