import React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Bike, PackageCheck, Truck, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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
import { ContactSelector } from "@/components/create-order/ContactSelector";
import { useContacts } from "@/hooks/useContacts";
import { Contact } from "@/services/contactService";

const UK_PHONE_REGEX = /^\+44[0-9]{10}$/; // Validates +44 followed by 10 digits
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Custom phone validation - spaces are already stripped by the input component
const phoneValidation = z
  .string()
  .min(1, "Phone number is required")
  .refine((val) => {
    // At this point, spaces should already be stripped
    return /^\+44\d{10}$/.test(val);
  }, {
    message: "Must be +44 followed by 10 digits",
  });

const orderSchema = z.object({
  sender: z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().regex(EMAIL_REGEX, "Invalid email format"),
    phone: phoneValidation,
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
    phone: phoneValidation,
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
    type: z.string().min(1, "Bike type is required"),
  })),
  customerOrderNumber: z.string().optional(),
  needsPaymentOnCollection: z.boolean().default(false),
  paymentCollectionPhone: z.string().optional(),
  isBikeSwap: z.boolean().default(false),
  partExchangeBikeBrand: z.string().optional(),
  partExchangeBikeModel: z.string().optional(),
  partExchangeBikeType: z.string().optional(),
  isEbayOrder: z.boolean().default(false),
  collectionCode: z.string().optional(),
  deliveryInstructions: z.string().optional(),
  needsInspection: z.boolean().default(false),
  // Legacy fields for backward compatibility
  bikeBrand: z.string().optional(),
  bikeModel: z.string().optional(),
}).superRefine((data, ctx) => {
  // Check eBay collection code
  if (data.isEbayOrder && !data.collectionCode?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Collection code is required for eBay orders",
      path: ["collectionCode"],
    });
  }
  
  // Check payment collection phone
  if (data.needsPaymentOnCollection && !data.paymentCollectionPhone?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Payment collection phone number is required",
      path: ["paymentCollectionPhone"],
    });
  }
  
  // Check part exchange bike details
  if (data.isBikeSwap) {
    if (!data.partExchangeBikeBrand?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Part exchange bike brand is required",
        path: ["partExchangeBikeBrand"],
      });
    }
    if (!data.partExchangeBikeModel?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Part exchange bike model is required",
        path: ["partExchangeBikeModel"],
      });
    }
    if (!data.partExchangeBikeType?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Part exchange bike type is required",
        path: ["partExchangeBikeType"],
      });
    }
  }
});

const CreateOrder = () => {
  const navigate = useNavigate();
  const { userProfile, user } = useAuth();
  const [activeTab, setActiveTab] = React.useState("details");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { data: contacts = [], isLoading: isLoadingContacts } = useContacts(user?.id);

  const form = useForm<CreateOrderFormData>({
    resolver: zodResolver(orderSchema),
    mode: "onChange", // Trigger validation on change for immediate feedback
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
      bikes: [{ brand: "", model: "", type: "" }],
      customerOrderNumber: "",
      needsPaymentOnCollection: false,
      paymentCollectionPhone: "",
      isBikeSwap: false,
      partExchangeBikeBrand: "",
      partExchangeBikeModel: "",
      partExchangeBikeType: "",
      isEbayOrder: false,
      collectionCode: "",
      deliveryInstructions: "",
      needsInspection: false,
      // Legacy fields for backward compatibility
      bikeBrand: "",
      bikeModel: "",
    },
  });

  const detailsFields = form.watch([
    "bikeQuantity",
    "bikes",
    "isEbayOrder",
    "collectionCode",
    "needsPaymentOnCollection",
    "paymentCollectionPhone",
    "isBikeSwap",
    "partExchangeBikeBrand",
    "partExchangeBikeModel",
    "partExchangeBikeType"
  ]);
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
    const bikesValid = bikeQuantity >= 1 && bikes.length === bikeQuantity && 
           bikes.every(bike => bike && bike.brand && bike.model && bike.type &&
                             bike.brand.trim() !== '' && bike.model.trim() !== '' && bike.type.trim() !== '');
    
    // Check conditional field requirements
    const isEbayOrder = form.getValues("isEbayOrder");
    const collectionCode = form.getValues("collectionCode");
    const needsPaymentOnCollection = form.getValues("needsPaymentOnCollection");
    const paymentCollectionPhone = form.getValues("paymentCollectionPhone");
    const isBikeSwap = form.getValues("isBikeSwap");
    const partExchangeBikeBrand = form.getValues("partExchangeBikeBrand");
    const partExchangeBikeModel = form.getValues("partExchangeBikeModel");
    const partExchangeBikeType = form.getValues("partExchangeBikeType");
    
    // eBay validation
    const ebayValid = !isEbayOrder || (collectionCode && collectionCode.trim() !== '');
    
    // Payment collection validation
    const paymentValid = !needsPaymentOnCollection || (paymentCollectionPhone && paymentCollectionPhone.trim() !== '');
    
    // Part exchange validation
    const swapValid = !isBikeSwap || (
      partExchangeBikeBrand && partExchangeBikeBrand.trim() !== '' &&
      partExchangeBikeModel && partExchangeBikeModel.trim() !== '' &&
      partExchangeBikeType && partExchangeBikeType.trim() !== ''
    );
    
    return bikesValid && ebayValid && paymentValid && swapValid;
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
      
      // Add bike details when multiple bikes
      if (data.bikes && data.bikes.length > 1) {
        const bikeList = data.bikes
          .map((bike, index) => `${index + 1}. ${bike.brand} ${bike.model} (${bike.type})`)
          .join('\n');
        deliveryInstructions += `\n\nBikes to collect:\n${bikeList}`;
      }
      
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
        bikeBrand: data.bikes.length > 1 ? 'Multiple bikes' : (data.bikes[0]?.brand || ''),
        bikeModel: data.bikes.length > 1 ? `${data.bikes.length} bikes` : (data.bikes[0]?.model || ''),
        bikeType: data.bikes.length > 1 ? 'Multiple types' : (data.bikes[0]?.type || ''),
        bikeQuantity: data.bikeQuantity,
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
    // Trigger validation for all fields on details tab including conditional ones
    form.trigger([
      "bikeQuantity",
      "bikes",
      "collectionCode",
      "paymentCollectionPhone",
      "partExchangeBikeBrand",
      "partExchangeBikeModel",
      "partExchangeBikeType"
    ]);
    
    if (isDetailsValid) {
      setActiveTab("sender");
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

  const fillMyDetails = (prefix: "sender" | "receiver") => {
    if (!userProfile) {
      toast.error("Profile information not available. Please complete your profile first.");
      navigate("/profile");
      return;
    }

    // Check if essential profile data is missing
    const missingFields = [];
    if (!userProfile.name) missingFields.push("name");
    if (!userProfile.email) missingFields.push("email");
    if (!userProfile.phone) missingFields.push("phone");
    if (!userProfile.address_line_1) missingFields.push("address");
    if (!userProfile.country) missingFields.push("country");

    if (missingFields.length > 0) {
      toast.error(`Please complete your profile first. Missing: ${missingFields.join(", ")}`);
      navigate("/profile");
      return;
    }

    // Format phone number to ensure +44 prefix
    let formattedPhone = userProfile.phone || "";
    if (formattedPhone && !formattedPhone.startsWith("+44")) {
      // Remove any leading zeros and add +44
      formattedPhone = formattedPhone.replace(/^0+/, "");
      formattedPhone = `+44${formattedPhone}`;
    }

    // Fill contact information
    form.setValue(`${prefix}.name`, userProfile.name);
    form.setValue(`${prefix}.email`, userProfile.email);
    form.setValue(`${prefix}.phone`, formattedPhone);

    // Fill address information
    form.setValue(`${prefix}.address.street`, userProfile.address_line_1);
    form.setValue(`${prefix}.address.city`, userProfile.city || "");
    form.setValue(`${prefix}.address.state`, userProfile.county || userProfile.address_line_2 || "");
    form.setValue(`${prefix}.address.zipCode`, userProfile.postal_code || "");
    form.setValue(`${prefix}.address.country`, userProfile.country || "United Kingdom");
    
    // Set coordinates if available
    if (userProfile.latitude && userProfile.longitude) {
      form.setValue(`${prefix}.address.lat`, userProfile.latitude);
      form.setValue(`${prefix}.address.lon`, userProfile.longitude);
    }

    toast.success("Details filled from your profile");
  };

  const fillFromContact = (contact: Contact, prefix: "sender" | "receiver") => {
    // Format phone number to ensure +44 prefix
    let formattedPhone = contact.phone || "+44";
    if (formattedPhone && !formattedPhone.startsWith("+44")) {
      formattedPhone = formattedPhone.replace(/^0+/, "");
      formattedPhone = `+44${formattedPhone}`;
    }

    // Fill contact information
    form.setValue(`${prefix}.name`, contact.name || "");
    form.setValue(`${prefix}.email`, contact.email || "");
    form.setValue(`${prefix}.phone`, formattedPhone);

    // Fill address information
    form.setValue(`${prefix}.address.street`, contact.street || "");
    form.setValue(`${prefix}.address.city`, contact.city || "");
    form.setValue(`${prefix}.address.state`, contact.state || "");
    form.setValue(`${prefix}.address.zipCode`, contact.postal_code || "");
    form.setValue(`${prefix}.address.country`, contact.country || "United Kingdom");
    
    // Set coordinates if available
    if (contact.lat && contact.lon) {
      form.setValue(`${prefix}.address.lat`, contact.lat);
      form.setValue(`${prefix}.address.lon`, contact.lon);
    }

    toast.success(`Filled from ${contact.name}`);
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
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
              <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                // Handle validation errors with user feedback
                console.log("Form validation errors:", errors);
                
                // Check which tab has errors and navigate there
                const hasDetailsErrors = errors.bikes || errors.bikeQuantity || errors.isEbayOrder || 
                  errors.collectionCode || errors.needsPaymentOnCollection || 
                  errors.paymentCollectionPhone || errors.isBikeSwap || 
                  errors.partExchangeBikeBrand || errors.partExchangeBikeModel || errors.partExchangeBikeType;
                
                const hasSenderErrors = errors.sender;
                const hasReceiverErrors = errors.receiver;
                
                if (hasDetailsErrors) {
                  setActiveTab("details");
                  toast.error("Please complete all required fields in Bike Details.");
                } else if (hasSenderErrors) {
                  setActiveTab("sender");
                  toast.error("Please complete all required fields in Collection Information.");
                } else if (hasReceiverErrors) {
                  setActiveTab("receiver");
                  toast.error("Please complete all required fields in Delivery Information.");
                } else {
                  // Generic error for any other validation failure
                  const firstErrorKey = Object.keys(errors)[0];
                  const firstError = errors[firstErrorKey as keyof typeof errors];
                  const errorMessage = typeof firstError === 'object' && firstError && 'message' in firstError 
                    ? String(firstError.message) 
                    : "Please complete all required fields.";
                  toast.error(errorMessage);
                }
              })} className="space-y-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col lg:flex-row gap-6">
                  <div className="w-full lg:w-64 space-y-4 shrink-0">
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
                    
                    <div className="text-sm text-muted-foreground pt-4 hidden lg:block">
                      <p>Complete all steps to create your bicycle courier order.</p>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 overflow-hidden">
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
                      <div className="overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                          <h3 className="text-lg font-medium">Collection Contact Information</h3>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => fillMyDetails("sender")}
                            className="flex items-center gap-2 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                          >
                            <User className="h-4 w-4" />
                            Fill in my details
                          </Button>
                        </div>
                        <div className="mb-4">
                          <ContactSelector
                            contacts={contacts}
                            onSelect={(contact) => fillFromContact(contact, "sender")}
                            isLoading={isLoadingContacts}
                            placeholder="Select from address book..."
                          />
                        </div>
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

                      <div className="flex flex-col sm:flex-row gap-3 sm:justify-between">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setActiveTab("details")}
                          className="w-full sm:w-auto"
                        >
                          Back to Order Details
                        </Button>
                        <Button 
                          type="button" 
                          onClick={handleNextToReceiver}
                          className="bg-courier-600 hover:bg-courier-700 w-full sm:w-auto"
                          disabled={!isSenderValid}
                        >
                          Next: Delivery Information
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="receiver" className="space-y-6 mt-0">
                      <div className="overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                          <h3 className="text-lg font-medium">Delivery Contact Information</h3>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => fillMyDetails("receiver")}
                            className="flex items-center gap-2 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                          >
                            <User className="h-4 w-4" />
                            Fill in my details
                          </Button>
                        </div>
                        <div className="mb-4">
                          <ContactSelector
                            contacts={contacts}
                            onSelect={(contact) => fillFromContact(contact, "receiver")}
                            isLoading={isLoadingContacts}
                            placeholder="Select from address book..."
                          />
                        </div>
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

                      <div className="flex flex-col sm:flex-row gap-3 sm:justify-between">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setActiveTab("sender")}
                          className="w-full sm:w-auto"
                        >
                          Back to Collection Information
                        </Button>
                        <Button 
                          type="submit" 
                          className="bg-courier-600 hover:bg-courier-700 w-full sm:w-auto"
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
