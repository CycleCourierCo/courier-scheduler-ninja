import React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Bike, PackageCheck, Truck } from "lucide-react";
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
      lat: z.number().optional(),
      lon: z.number().optional(),
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
      lat: z.number().optional(),
      lon: z.number().optional(),
    }),
  }),
  bikeQuantity: z.number().min(1).max(8),
  bikes: z.array(z.object({
    brand: z.string().min(1, "Bike brand is required"),
    model: z.string().min(1, "Bike model is required"),
  })),
  customerOrderNumber: z.string().optional(),
  needsPaymentOnCollection: z.boolean().default(false),
  paymentCollectionPhone: z.string().regex(UK_PHONE_REGEX, "Phone must be in format +44XXXXXXXXXX").optional().or(z.literal("")),
  isBikeSwap: z.boolean().default(false),
  isEbayOrder: z.boolean().default(false),
  collectionCode: z.string().optional(),
  deliveryInstructions: z.string().optional(),
  // Legacy fields for backward compatibility
  bikeBrand: z.string().optional(),
  bikeModel: z.string().optional(),
}).refine((data) => {
  if (data.isEbayOrder && !data.collectionCode) {
    return false;
  }
  if (data.needsPaymentOnCollection && !data.paymentCollectionPhone) {
    return false;
  }
  return true;
}, {
  message: "Required fields missing for selected options",
});

const CreateOrder = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState("details");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
          lat: undefined,
          lon: undefined,
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
          lat: undefined,
          lon: undefined,
        },
      },
      bikeQuantity: 1,
      bikes: [{ brand: "", model: "" }],
      customerOrderNumber: "",
      needsPaymentOnCollection: false,
      paymentCollectionPhone: "",
      isBikeSwap: false,
      isEbayOrder: false,
      collectionCode: "",
      deliveryInstructions: "",
      // Legacy fields for backward compatibility
      bikeBrand: "",
      bikeModel: "",
    },
    mode: "onChange",
  });

  const detailsFields = form.watch(["bikeQuantity", "bikes"]);
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
    const bikeQuantity = form.getValues("bikeQuantity");
    const bikes = form.getValues("bikes") || [];
    return bikeQuantity >= 1 && bikes.length === bikeQuantity && 
           bikes.every(bike => bike && bike.brand && bike.model && 
                             bike.brand.trim() !== '' && bike.model.trim() !== '');
  }, [detailsFields, form]);

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
      // Transform the new format to include legacy fields for backward compatibility
      let deliveryInstructions = data.deliveryInstructions || '';
      
      // Add collection code for eBay orders
      if (data.isEbayOrder && data.collectionCode) {
        deliveryInstructions += `\n\nCollection code: ${data.collectionCode}`;
      }
      
      // Add payment collection message when required
      if (data.needsPaymentOnCollection && data.paymentCollectionPhone) {
        deliveryInstructions += `\n\nPayment required when collecting, please call ${data.paymentCollectionPhone}`;
      }
      
      const transformedData = {
        ...data,
        bikeBrand: data.bikes[0]?.brand || '',
        bikeModel: data.bikes[0]?.model || '',
        deliveryInstructions: deliveryInstructions.trim(),
      };
      
      const order = await createOrder(transformedData);
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
    const bikes = form.getValues("bikes") || [];
    const bikeQuantity = form.getValues("bikeQuantity");
    
    form.trigger(["bikeQuantity", "bikes"]);
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

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
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
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-64 space-y-4">
                    <h3 className="text-base font-medium mb-2">Order Steps</h3>
                    <TabsList orientation="vertical" className="w-full bg-muted/60">
                      <TabsTrigger 
                        value="details" 
                        className="justify-start text-left"
                        icon={<Bike className="h-4 w-4" />}
                      >
                        Bike Details
                      </TabsTrigger>
                      <TabsTrigger 
                        value="sender" 
                        className="justify-start text-left"
                        icon={<PackageCheck className="h-4 w-4" />}
                        disabled={!isDetailsValid}
                      >
                        Collection Information
                      </TabsTrigger>
                      <TabsTrigger 
                        value="receiver" 
                        className="justify-start text-left"
                        icon={<Truck className="h-4 w-4" />}
                        disabled={!isSenderValid || !isDetailsValid}
                      >
                        Delivery Information
                      </TabsTrigger>
                    </TabsList>
                    
                    <div className="text-sm text-muted-foreground pt-4">
                      <p>Complete all steps to create your bicycle courier order.</p>
                    </div>
                  </div>

                  <div className="flex-1">
                    <TabsContent value="details" className="space-y-6 mt-0">
                      <OrderDetails control={form.control} />
                      <OrderOptions control={form.control} />
                      <DeliveryInstructions control={form.control} />

                      <div className="flex justify-end">
                        <Button 
                          type="button" 
                          onClick={handleNextToSender}
                          className="bg-courier-600 hover:bg-courier-700"
                          disabled={!isDetailsValid}
                        >
                          Next: Collection Information
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="sender" className="space-y-6 mt-0">
                      <div>
                        <h3 className="text-lg font-medium mb-4">Collection Contact Information</h3>
                        <ContactForm control={form.control} prefix="sender" />
                      </div>

                      <div>
                        <h3 className="text-lg font-medium mb-4">Collection Address</h3>
                        <AddressForm 
                          control={form.control} 
                          prefix="sender.address" 
                          setValue={form.setValue}
                        />
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
                          onClick={handleNextToReceiver}
                          className="bg-courier-600 hover:bg-courier-700"
                          disabled={!isSenderValid}
                        >
                          Next: Delivery Information
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="receiver" className="space-y-6 mt-0">
                      <div>
                        <h3 className="text-lg font-medium mb-4">Delivery Contact Information</h3>
                        <ContactForm control={form.control} prefix="receiver" />
                      </div>

                      <div>
                        <h3 className="text-lg font-medium mb-4">Delivery Address</h3>
                        <AddressForm 
                          control={form.control} 
                          prefix="receiver.address" 
                          setValue={form.setValue}
                        />
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
                          disabled={isSubmitting || !isReceiverValid}
                        >
                          {isSubmitting ? "Creating Order..." : "Create Order"}
                        </Button>
                      </div>
                    </TabsContent>
                  </div>
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
