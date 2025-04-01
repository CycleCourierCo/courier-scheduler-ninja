
import React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Layout from "@/components/Layout";
import ContactForm from "@/components/ContactForm";
import AddressForm from "@/components/AddressForm";
import { createOrder } from "@/services/orderService";
import { CreateOrderFormData } from "@/types/order";
import OrderDetails from "@/components/create-order/OrderDetails";
import OrderOptions from "@/components/create-order/OrderOptions";
import DeliveryInstructions from "@/components/create-order/DeliveryInstructions";
import { useIsMobile } from "@/hooks/use-mobile";

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
  deliveryInstructions: z.string().optional(),
});

const CreateOrder = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState("details");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isMobile = useIsMobile();

  const form = useForm<CreateOrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      sender: {
        name: "",
        email: "",
        phone: "+44",
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
        phone: "+44",
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
    mode: "onChange",
  });

  const detailsFields = form.watch(["bikeBrand", "bikeModel"]);
  const senderFields = form.watch([
    "sender.name", 
    "sender.email", 
    "sender.phone", 
    "sender.address.street",
    "sender.address.city",
    "sender.address.state",
    "sender.address.zipCode",
    "sender.address.country"
  ]);
  const receiverFields = form.watch([
    "receiver.name", 
    "receiver.email", 
    "receiver.phone", 
    "receiver.address.street",
    "receiver.address.city",
    "receiver.address.state",
    "receiver.address.zipCode",
    "receiver.address.country"
  ]);

  const isDetailsValid = React.useMemo(() => {
    return detailsFields.every(field => field && String(field).trim() !== '');
  }, [detailsFields]);

  const isSenderValid = React.useMemo(() => {
    const allFieldsFilled = senderFields.every(field => field && String(field).trim() !== '');
    
    const senderEmail = form.getValues("sender.email");
    const senderPhone = form.getValues("sender.phone");
    
    const isEmailValid = EMAIL_REGEX.test(senderEmail);
    const isPhoneValid = UK_PHONE_REGEX.test(senderPhone);
    
    return allFieldsFilled && isEmailValid && isPhoneValid;
  }, [senderFields, form]);

  const isReceiverValid = React.useMemo(() => {
    const allFieldsFilled = receiverFields.every(field => field && String(field).trim() !== '');
    
    const receiverEmail = form.getValues("receiver.email");
    const receiverPhone = form.getValues("receiver.phone");
    
    const isEmailValid = EMAIL_REGEX.test(receiverEmail);
    const isPhoneValid = UK_PHONE_REGEX.test(receiverPhone);
    
    return allFieldsFilled && isEmailValid && isPhoneValid;
  }, [receiverFields, form]);

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

  const handleNextToSender = () => {
    form.trigger(["bikeBrand", "bikeModel"]);
    if (isDetailsValid) {
      setActiveTab("sender");
    } else {
      toast.error("Please fill in all required fields in Order Details.");
    }
  };

  const handleNextToReceiver = () => {
    form.trigger([
      "sender.name", 
      "sender.email", 
      "sender.phone", 
      "sender.address.street",
      "sender.address.city",
      "sender.address.state",
      "sender.address.zipCode",
      "sender.address.country"
    ]);
    
    if (isSenderValid) {
      setActiveTab("receiver");
    } else {
      toast.error("Please fill in all required fields in Collection Information.");
    }
  };

  // This function does nothing to prevent tab clicks from changing tabs
  const handleTabClick = (value: string) => {
    // Intentionally empty - prevents tab switching on click
    return;
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="text-2xl md:text-3xl font-bold text-courier-800 mb-4 md:mb-6">Create New Order</h1>
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl md:text-2xl">Order Details</CardTitle>
            <CardDescription>
              Enter the order information to create a new courier order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Tabs value={activeTab} onValueChange={handleTabClick} className="w-full">
                  <TabsList className={`grid w-full grid-cols-3 mb-6 ${isMobile ? 'text-xs' : ''}`}>
                    <TabsTrigger 
                      value="details" 
                      className={`${activeTab === "details" ? "bg-courier-600 text-white hover:bg-courier-700" : "opacity-70"} cursor-default`}
                      disabled={true}
                    >
                      Order Details
                    </TabsTrigger>
                    <TabsTrigger 
                      value="sender" 
                      className={`${activeTab === "sender" ? "bg-courier-600 text-white hover:bg-courier-700" : "opacity-70"} cursor-default`}
                      disabled={true}
                    >
                      Collection Info
                    </TabsTrigger>
                    <TabsTrigger 
                      value="receiver" 
                      className={`${activeTab === "receiver" ? "bg-courier-600 text-white hover:bg-courier-700" : "opacity-70"} cursor-default`}
                      disabled={true}
                    >
                      Delivery Info
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-6 w-full">
                    <OrderDetails control={form.control} />
                    <OrderOptions control={form.control} />
                    <DeliveryInstructions control={form.control} />

                    <div className="flex justify-end w-full">
                      <Button 
                        type="button" 
                        onClick={handleNextToSender}
                        className="bg-courier-600 hover:bg-courier-700 w-full md:w-auto"
                        disabled={!isDetailsValid}
                      >
                        Next: Collection Information
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="sender" className="space-y-6 w-full">
                    <div className="w-full">
                      <h3 className="text-lg font-medium mb-4">Collection Contact Information</h3>
                      <ContactForm control={form.control} prefix="sender" />
                    </div>

                    <div className="w-full">
                      <h3 className="text-lg font-medium mb-4">Collection Address</h3>
                      <AddressForm 
                        control={form.control} 
                        prefix="sender.address" 
                        setValue={form.setValue}
                      />
                    </div>

                    <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'justify-between'} w-full`}>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setActiveTab("details")}
                        className={isMobile ? "w-full" : ""}
                      >
                        Back to Order Details
                      </Button>
                      <Button 
                        type="button" 
                        onClick={handleNextToReceiver}
                        className={`bg-courier-600 hover:bg-courier-700 ${isMobile ? "w-full" : ""}`}
                        disabled={!isSenderValid}
                      >
                        Next: Delivery Information
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="receiver" className="space-y-6 w-full">
                    <div className="w-full">
                      <h3 className="text-lg font-medium mb-4">Delivery Contact Information</h3>
                      <ContactForm control={form.control} prefix="receiver" />
                    </div>

                    <div className="w-full">
                      <h3 className="text-lg font-medium mb-4">Delivery Address</h3>
                      <AddressForm 
                        control={form.control} 
                        prefix="receiver.address" 
                        setValue={form.setValue}
                      />
                    </div>

                    <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'justify-between'} w-full`}>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setActiveTab("sender")}
                        className={isMobile ? "w-full" : ""}
                      >
                        Back to Collection Information
                      </Button>
                      <Button 
                        type="submit" 
                        className={`bg-courier-600 hover:bg-courier-700 ${isMobile ? "w-full" : ""}`}
                        disabled={isSubmitting || !isReceiverValid}
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
