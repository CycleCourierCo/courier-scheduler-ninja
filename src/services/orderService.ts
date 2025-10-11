import { supabase } from "@/integrations/supabase/client";
import { Order, OrderStatus } from "@/types/order";
import { CreateOrderFormData } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";
import { createJobsForOrder } from "./jobService";
import { 
  sendOrderCreationConfirmationToUser,
  sendOrderNotificationToReceiver, 
  resendReceiverAvailabilityEmail,
  sendSenderAvailabilityEmail,
  resendSenderAvailabilityEmail,
  sendReceiverAvailabilityEmail
} from "@/services/emailService";
import { generateTrackingNumber } from "@/services/trackingService";

export const getOrder = async (id: string): Promise<Order | null> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return null;
    }

    return mapDbOrderToOrderType(data);
  } catch (error) {
    return null;
  }
};

export const getOrderById = getOrder;

export const getPublicOrder = async (id: string): Promise<Order | null> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, bike_brand, bike_model, sender_notes, receiver_notes, pickup_date, delivery_date")
      .eq("id", id)
      .single();

    if (error) {
      return null;
    }

    return mapDbOrderToOrderType(data);
  } catch (error) {
    return null;
  }
};

export const getOrders = async (): Promise<Order[]> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*");

    if (error) {
      return [];
    }

    return data.map(mapDbOrderToOrderType);
  } catch (error) {
    return [];
  }
};

export interface OrderFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: string;
  userId?: string;
  userRole?: string;
}

export interface OrdersResponse {
  data: Order[];
  count: number;
}

export const getOrdersWithFilters = async (filters: OrderFilters = {}): Promise<OrdersResponse> => {
  try {
    const {
      page = 1,
      pageSize = 10,
      search = "",
      status = [],
      dateFrom,
      dateTo,
      sortBy = "created_desc",
      userId,
      userRole
    } = filters;

    let query = supabase.from("orders").select("*", { count: "exact" });

    // Apply role-based filtering
    if (userRole !== "admin" && userRole !== "route_planner" && userId) {
      query = query.eq("user_id", userId);
    }

    // Apply search filter across multiple fields
    if (search && search.trim()) {
      const searchTerm = search.trim();
      query = query.or(
        `sender->>name.ilike.%${searchTerm}%,` +
        `receiver->>name.ilike.%${searchTerm}%,` +
        `id::text.ilike.%${searchTerm}%,` +
        `tracking_number.ilike.%${searchTerm}%,` +
        `bike_brand.ilike.%${searchTerm}%,` +
        `bike_model.ilike.%${searchTerm}%,` +
        `customer_order_number.ilike.%${searchTerm}%`
      );
    }

    // Apply status filter
    if (status.length > 0) {
      query = query.in("status", status as any);
    }

    // Apply date range filter
    if (dateFrom) {
      query = query.gte("created_at", dateFrom.toISOString());
    }
    if (dateTo) {
      const dateToEnd = new Date(dateTo);
      dateToEnd.setHours(23, 59, 59, 999);
      query = query.lte("created_at", dateToEnd.toISOString());
    }

    // Apply sorting
    switch (sortBy) {
      case "created_asc":
        query = query.order("created_at", { ascending: true });
        break;
      case "created_desc":
        query = query.order("created_at", { ascending: false });
        break;
      case "sender_name":
        query = query.order("sender->name", { ascending: true });
        break;
      case "receiver_name":
        query = query.order("receiver->name", { ascending: true });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    // Apply pagination
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    query = query.range(start, end);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching orders:", error);
      return { data: [], count: 0 };
    }

    return {
      data: (data || []).map(mapDbOrderToOrderType),
      count: count || 0
    };
  } catch (error) {
    console.error("Error in getOrdersWithFilters:", error);
    return { data: [], count: 0 };
  }
};

export const updateOrderStatus = async (id: string, status: OrderStatus): Promise<Order | null> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return null;
    }

    return mapDbOrderToOrderType(data);
  } catch (error) {
    return null;
  }
};

export const updateAdminOrderStatus = updateOrderStatus;

export const createOrder = async (data: CreateOrderFormData): Promise<Order> => {
  try {
    const { sender, receiver, bikeBrand, bikeModel, bikeQuantity, bikes, customerOrderNumber, needsPaymentOnCollection, paymentCollectionPhone, isBikeSwap, partExchangeBikeBrand, partExchangeBikeModel, isEbayOrder, collectionCode, deliveryInstructions } = data;

    const {
      street: senderStreet,
      city: senderCity,
      state: senderState,
      zipCode: senderZipCode,
      country: senderCountry,
      lat: senderLat,
      lon: senderLon,
    } = sender.address;

    const {
      street: receiverStreet,
      city: receiverCity,
      state: receiverState,
      zipCode: receiverZipCode,
      country: receiverCountry,
      lat: receiverLat,
      lon: receiverLon,
    } = receiver.address;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // -- Get user profile details for name/email --
    // Prefer `user.user_metadata.name`, fall back to profile, fall back to email.
    let userName: string | null = null;
    let userEmail: string | null = null;
    try {
      userEmail = user.email;
      userName = user.user_metadata?.name || null;

      // Try profile if name is not there
      if (!userName && user.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .maybeSingle();
        if (profile && profile.name) {
          userName = profile.name;
        }
      }
    } catch (userErr) {
      // Silently handle profile fetch errors
    }
    if (!userName) userName = userEmail || "Customer";

    const timestamp = new Date().toISOString();

    const trackingNumber = await generateTrackingNumber(sender.name, receiver.address.zipCode);

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        sender: {
          name: sender.name,
          email: sender.email,
          phone: sender.phone,
          address: {
            street: senderStreet,
            city: senderCity,
            state: senderState,
            zipCode: senderZipCode,
            country: senderCountry,
            lat: senderLat,
            lon: senderLon,
          },
        },
        receiver: {
          name: receiver.name,
          email: receiver.email,
          phone: receiver.phone,
          address: {
            street: receiverStreet,
            city: receiverCity,
            state: receiverState,
            zipCode: receiverZipCode,
            country: receiverCountry,
            lat: receiverLat,
            lon: receiverLon,
          },
        },
        bike_brand: bikeBrand || bikes?.[0]?.brand,
        bike_model: bikeModel || bikes?.[0]?.model,
        bike_quantity: bikeQuantity || 1,
        customer_order_number: customerOrderNumber,
        needs_payment_on_collection: needsPaymentOnCollection,
        payment_collection_phone: paymentCollectionPhone,
        is_bike_swap: isBikeSwap,
        is_ebay_order: isEbayOrder,
        collection_code: collectionCode,
        delivery_instructions: deliveryInstructions,
        status: "created",
        created_at: timestamp,
        updated_at: timestamp,
        tracking_number: trackingNumber,
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }

    const orderWithJobs = mapDbOrderToOrderType(order);
    await createJobsForOrder(orderWithJobs);
    
    // Create reverse order for part exchange
    if (isBikeSwap && partExchangeBikeBrand && partExchangeBikeModel) {
      try {
        const reverseTrackingNumber = await generateTrackingNumber(receiver.name, sender.address.zipCode);
        
        const { data: reverseOrder, error: reverseError } = await supabase
          .from("orders")
          .insert({
            user_id: user.id,
            sender: {
              name: receiver.name,
              email: receiver.email,
              phone: receiver.phone,
              address: {
                street: receiverStreet,
                city: receiverCity,
                state: receiverState,
                zipCode: receiverZipCode,
                country: receiverCountry,
                lat: receiverLat,
                lon: receiverLon,
              },
            },
            receiver: {
              name: sender.name,
              email: sender.email,
              phone: sender.phone,
              address: {
                street: senderStreet,
                city: senderCity,
                state: senderState,
                zipCode: senderZipCode,
                country: senderCountry,
                lat: senderLat,
                lon: senderLon,
              },
            },
            bike_brand: partExchangeBikeBrand,
            bike_model: partExchangeBikeModel,
            bike_quantity: 1,
            customer_order_number: customerOrderNumber ? `${customerOrderNumber}-RETURN` : undefined,
            needs_payment_on_collection: false,
            is_bike_swap: false, // The reverse order is not itself a swap
            is_ebay_order: false,
            delivery_instructions: `Part exchange return for order ${trackingNumber}`,
            status: 'created',
            created_at: timestamp,
            updated_at: timestamp,
            tracking_number: reverseTrackingNumber,
          })
          .select()
          .single();
        
        if (!reverseError) {
          const reverseOrderWithJobs = mapDbOrderToOrderType(reverseOrder);
          await createJobsForOrder(reverseOrderWithJobs);
        }
      } catch (reverseOrderError) {
        // Don't throw here - we don't want to fail the main order creation
      }
    }
    
    const sendEmails = async () => {
      try {
        // 1. Confirmation email to user (not sender)
        const userEmailResult = await sendOrderCreationConfirmationToUser(order.id, userEmail!, userName!);
        
        // 2. Sender availability email as before
        const senderAvailabilityResult = await sendSenderAvailabilityEmail(order.id);
        
        // 3. Receiver notification email as before
        const receiverEmailResult = await sendOrderNotificationToReceiver(order.id);
        
        return { 
          userConfirmation: userEmailResult, 
          senderAvailability: senderAvailabilityResult,
          receiver: receiverEmailResult 
        };
      } catch (emailError) {
        return { 
          userConfirmation: false, 
          senderAvailability: false,
          receiver: false, 
          error: emailError 
        };
      }
    };
    
    sendEmails().catch(() => {
      // Handle errors silently in background
    });
    
    // Create Shipday jobs automatically after order creation
    const createShipdayJobs = async () => {
      try {
        const { createShipdayOrder } = await import('@/services/shipdayService');
        await createShipdayOrder(order.id);
      } catch (shipdayError) {
        console.error('Failed to create Shipday jobs:', shipdayError);
        // Don't fail the order creation if Shipday fails
      }
    };
    
    createShipdayJobs().catch(() => {
      // Handle errors silently in background
    });
    
    return mapDbOrderToOrderType(order);
  } catch (error) {
    throw error;
  }
};

export const updateOrderSchedule = async (
  id: string,
  pickupDate?: Date,
  deliveryDate?: Date
): Promise<Order | null> => {
  try {
    let status = 'scheduled';
    if (pickupDate && !deliveryDate) {
      status = 'collection_scheduled';
    } else if (!pickupDate && deliveryDate) {
      status = 'delivery_scheduled';
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (pickupDate) {
      updateData.scheduled_pickup_date = pickupDate.toISOString();
    }
    if (deliveryDate) {
      updateData.scheduled_delivery_date = deliveryDate.toISOString();
    }
    if (pickupDate && deliveryDate) {
      updateData.scheduled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return null;
    }

    return mapDbOrderToOrderType(data);
  } catch (error) {
    return null;
  }
};

export const updateOrderScheduledDates = async (
  id: string,
  pickupDate: Date,
  deliveryDate: Date
): Promise<Order | null> => {
  return updateOrderSchedule(id, pickupDate, deliveryDate);
};

export { resendSenderAvailabilityEmail, resendReceiverAvailabilityEmail };

export const pollOrderUpdates = (
  orderId: string, 
  callback: (order: Order) => void,
  interval: number = 10000
): () => void => {
  const intervalId = setInterval(async () => {
    try {
      const updatedOrder = await getOrder(orderId);
      if (updatedOrder) {
        callback(updatedOrder);
      }
    } catch (error) {
      // Silently handle polling errors
    }
  }, interval);

  return () => clearInterval(intervalId);
};
