import { supabase } from "@/integrations/supabase/client";
import { Order, OrderStatus } from "@/types/order";
import { CreateOrderFormData } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";
import { sendOrderCreationEmailToSender, sendOrderNotificationToReceiver } from "@/services/emailService";

export const getOrder = async (id: string): Promise<Order | null> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching order:", error);
      return null;
    }

    return mapDbOrderToOrderType(data);
  } catch (error) {
    console.error("Unexpected error fetching order:", error);
    return null;
  }
};

export const getPublicOrder = async (id: string): Promise<Order | null> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, bike_brand, bike_model, sender_notes, receiver_notes, pickup_date, delivery_date")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching public order:", error);
      return null;
    }

    return mapDbOrderToOrderType(data);
  } catch (error) {
    console.error("Unexpected error fetching public order:", error);
    return null;
  }
};

export const getOrders = async (): Promise<Order[]> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*");

    if (error) {
      console.error("Error fetching orders:", error);
      return [];
    }

    return data.map(mapDbOrderToOrderType);
  } catch (error) {
    console.error("Unexpected error fetching orders:", error);
    return [];
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
      console.error("Error updating order status:", error);
      return null;
    }

    return mapDbOrderToOrderType(data);
  } catch (error) {
    console.error("Unexpected error updating order status:", error);
    return null;
  }
};

export const createOrder = async (data: CreateOrderFormData): Promise<Order> => {
  try {
    const { sender, receiver, bikeBrand, bikeModel, customerOrderNumber, needsPaymentOnCollection, isBikeSwap, deliveryInstructions } = data;

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

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
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
        bike_brand: bikeBrand,
        bike_model: bikeModel,
        customer_order_number: customerOrderNumber,
        needs_payment_on_collection: needsPaymentOnCollection,
        is_bike_swap: isBikeSwap,
        delivery_instructions: deliveryInstructions,
        status: "created",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    try {
      console.log("Sending order creation email to sender:", order.id);
      const senderEmailSent = await sendOrderCreationEmailToSender(order.id);
      console.log("Sender email sent:", senderEmailSent);
      
      console.log("Sending order notification to receiver:", order.id);
      const receiverEmailSent = await sendOrderNotificationToReceiver(order.id);
      console.log("Receiver email sent:", receiverEmailSent);
    } catch (emailError) {
      console.error("Error sending order creation emails:", emailError);
    }
    
    return mapDbOrderToOrderType(order);
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
};
