
import { supabase } from "@/integrations/supabase/client";

/**
 * Email Template Types
 */
export const EmailTemplates = {
  // Business Account Emails
  BUSINESS_ACCOUNT_CREATED: "business_account_created",
  BUSINESS_ACCOUNT_APPROVED: "business_account_approved",
  BUSINESS_ACCOUNT_REJECTED: "business_account_rejected",
  
  // Order Emails
  ORDER_CREATED_SENDER: "order_created_sender",
  ORDER_CREATED_RECEIVER: "order_created_receiver",
  SENDER_AVAILABILITY: "sender_availability",
  RECEIVER_AVAILABILITY: "receiver_availability",
  DELIVERY_CONFIRMATION: "delivery_confirmation"
};

/**
 * Send an email to a business account applicant confirming receipt of their application
 */
export const sendBusinessAccountCreationEmail = async (email: string, name: string): Promise<boolean> => {
  try {
    console.log("Sending business account creation confirmation email to:", email);
    
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: email,
        emailType: EmailTemplates.BUSINESS_ACCOUNT_CREATED,
        name: name
      }
    });
    
    if (response.error) {
      console.error("Error sending business account creation email:", response.error);
      return false;
    }
    
    console.log("Business account creation email sent successfully");
    return true;
  } catch (error) {
    console.error("Failed to send business account creation email:", error);
    return false;
  }
};

/**
 * Send an email to a business account applicant informing them of their approval
 */
export const sendAccountApprovalEmail = async (email: string, name: string, companyName?: string): Promise<boolean> => {
  try {
    console.log("Sending account approval email to:", email);
    
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: email,
        emailType: EmailTemplates.BUSINESS_ACCOUNT_APPROVED,
        name: name,
        companyName: companyName
      }
    });
    
    if (response.error) {
      console.error("Error sending account approval email:", response.error);
      return false;
    }
    
    console.log("Account approval email sent successfully");
    return true;
  } catch (error) {
    console.error("Failed to send account approval email:", error);
    return false;
  }
};

/**
 * Send an email to a business account applicant informing them of their rejection
 */
export const sendAccountRejectionEmail = async (email: string, name: string): Promise<boolean> => {
  try {
    console.log("Sending account rejection email to:", email);
    
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: email,
        emailType: EmailTemplates.BUSINESS_ACCOUNT_REJECTED,
        name: name
      }
    });
    
    if (response.error) {
      console.error("Error sending account rejection email:", response.error);
      return false;
    }
    
    console.log("Account rejection email sent successfully");
    return true;
  } catch (error) {
    console.error("Failed to send account rejection email:", error);
    return false;
  }
};

/**
 * Send order creation confirmation email to the sender
 */
export const sendOrderCreationEmailToSender = async (id: string): Promise<boolean> => {
  try {
    console.log("Sending order creation confirmation email to sender for order ID:", id);
    
    // Use the current domain dynamically
    const baseUrl = window.location.origin;
    
    const response = await supabase.functions.invoke("send-email", {
      body: {
        emailType: EmailTemplates.ORDER_CREATED_SENDER,
        orderId: id,
        baseUrl
      }
    });
    
    if (response.error) {
      console.error("Error sending order creation email to sender:", response.error);
      return false;
    }
    
    console.log("Order creation email sent successfully to sender for order:", id);
    return true;
  } catch (error) {
    console.error("Failed to send order creation email to sender:", error);
    return false;
  }
};

/**
 * Send order notification email to the receiver
 */
export const sendOrderNotificationToReceiver = async (id: string): Promise<boolean> => {
  try {
    console.log("Sending order notification email to receiver for order ID:", id);
    
    // Use the current domain dynamically
    const baseUrl = window.location.origin;
    
    const response = await supabase.functions.invoke("send-email", {
      body: {
        emailType: EmailTemplates.ORDER_CREATED_RECEIVER,
        orderId: id,
        baseUrl
      }
    });
    
    if (response.error) {
      console.error("Error sending order notification email to receiver:", response.error);
      return false;
    }
    
    console.log("Order notification email sent successfully to receiver for order:", id);
    return true;
  } catch (error) {
    console.error("Failed to send order notification email to receiver:", error);
    return false;
  }
};

// Define interfaces for sender and receiver objects
interface Person {
  name: string;
  email: string;
  phone?: string;
  address?: any;
}

/**
 * Send availability request email to the sender
 */
export const sendSenderAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    console.log("Starting to send sender availability email for order ID:", id);
    
    // Get the order details from the database
    const { data: order, error } = await supabase
      .from("orders")
      .select("sender, bike_brand, bike_model")
      .eq("id", id)
      .single();
    
    if (error || !order) {
      console.error("Error fetching order for sender availability email:", error);
      return false;
    }
    
    // Type assertion for sender object
    const sender = order.sender as Person;
    
    // Use the current domain dynamically
    const baseUrl = window.location.origin;
    console.log("Using base URL for email:", baseUrl);
    
    // Create item from bike details
    const item = {
      name: `${order.bike_brand || ""} ${order.bike_model || ""}`.trim() || "Bicycle",
      quantity: 1
    };
    
    console.log("Sending sender availability email to:", sender.email);
    
    // Send email to sender with improved error handling
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: sender.email,
        name: sender.name || "Sender",
        orderId: id,
        baseUrl,
        emailType: "sender", // Using the string identifier to match the edge function
        item: item
      }
    });
    
    if (response.error) {
      console.error("Error sending availability email to sender:", response.error);
      return false;
    }
    
    console.log("Sender availability email sent successfully");
    return true;
  } catch (error) {
    console.error("Failed to send sender availability email:", error);
    return false;
  }
};

/**
 * Resend availability request email to the sender
 */
export const resendSenderAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    console.log("Resending sender availability email for order ID:", id);
    return await sendSenderAvailabilityEmail(id);
  } catch (error) {
    console.error("Error resending sender availability email:", error);
    return false;
  }
};

/**
 * Send availability request email to the receiver
 */
export const sendReceiverAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    console.log("Starting to send receiver availability email for order ID:", id);
    
    // Get the order details from the database
    const { data: order, error } = await supabase
      .from("orders")
      .select("receiver, bike_brand, bike_model")
      .eq("id", id)
      .single();
    
    if (error || !order) {
      console.error("Error fetching order for receiver availability email:", error);
      return false;
    }
    
    // Type assertion for receiver object
    const receiver = order.receiver as Person;
    
    // Use the current domain dynamically
    const baseUrl = window.location.origin;
    console.log("Using base URL for email:", baseUrl);
    
    // Create item from bike details
    const item = {
      name: `${order.bike_brand || ""} ${order.bike_model || ""}`.trim() || "Bicycle",
      quantity: 1
    };
    
    console.log("Sending receiver availability email to:", receiver.email);
    
    // Send email to receiver with improved error handling
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: receiver.email,
        name: receiver.name || "Receiver",
        orderId: id,
        baseUrl,
        emailType: "receiver", // Using the string identifier to match the edge function
        item: item
      }
    });
    
    if (response.error) {
      console.error("Error sending availability email to receiver:", response.error);
      return false;
    }
    
    console.log("Receiver availability email sent successfully");
    return true;
  } catch (error) {
    console.error("Failed to send receiver availability email:", error);
    return false;
  }
};

/**
 * Resend availability request email to the receiver
 */
export const resendReceiverAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    console.log("Resending receiver availability email for order ID:", id);
    return await sendReceiverAvailabilityEmail(id);
  } catch (error) {
    console.error("Error resending receiver availability email:", error);
    return false;
  }
};

/**
 * Send delivery confirmation emails to both sender and receiver
 */
export const sendDeliveryConfirmationEmails = async (id: string): Promise<boolean> => {
  try {
    console.log("Sending delivery confirmation emails for order ID:", id);
    
    const response = await supabase.functions.invoke("send-email", {
      body: {
        meta: {
          action: "delivery_confirmation",
          orderId: id
        }
      }
    });
    
    if (response.error) {
      console.error("Error sending delivery confirmation emails:", response.error);
      return false;
    }
    
    console.log("Delivery confirmation emails sent successfully");
    return true;
  } catch (error) {
    console.error("Failed to send delivery confirmation emails:", error);
    return false;
  }
};
