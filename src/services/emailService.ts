
import { supabase } from "@/integrations/supabase/client";
import { getOrder } from "./fetchOrderService";

export const resendSenderAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    console.log("Starting to resend sender availability email for order ID:", id);
    
    // Get the order details first
    const order = await getOrder(id);
    
    // Ensure the order exists and has a sender
    if (!order || !order.sender || !order.sender.email) {
      console.error("Order or sender information not found for ID:", id);
      return false;
    }
    
    // Use the current domain dynamically
    const baseUrl = window.location.origin;
    console.log("Using base URL for email:", baseUrl);
    
    // Create item from bike details
    const item = {
      name: `${order.bikeBrand} ${order.bikeModel}`.trim(),
      quantity: 1,
      price: 0
    };
    
    console.log("Sending sender email to:", order.sender.email);
    
    // Send email to sender with improved error handling
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: order.sender.email,
        name: order.sender.name || "Sender",
        orderId: id,
        baseUrl,
        emailType: "sender",
        item: item
      }
    });
    
    if (response.error) {
      console.error("Error resending email to sender:", response.error);
      return false;
    }
    
    console.log("Email resent successfully to sender:", order.sender.email);
    return true;
  } catch (error) {
    console.error("Failed to resend email:", error);
    return false;
  }
};

export const resendReceiverAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    console.log("Starting to send receiver availability email for order ID:", id);
    
    // Get the order details first
    const order = await getOrder(id);
    
    // Ensure the order exists and has a receiver
    if (!order || !order.receiver || !order.receiver.email) {
      console.error("Order or receiver information not found for ID:", id);
      return false;
    }
    
    // Use the current domain dynamically
    const baseUrl = window.location.origin;
    console.log("Using base URL for email:", baseUrl);
    
    // Create item from bike details
    const item = {
      name: `${order.bikeBrand} ${order.bikeModel}`.trim(),
      quantity: 1,
      price: 0
    };
    
    console.log("Sending receiver email to:", order.receiver.email);
    
    // Send email to receiver with improved error handling
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: order.receiver.email,
        name: order.receiver.name || "Receiver",
        orderId: id,
        baseUrl,
        emailType: "receiver",
        item: item
      }
    });
    
    if (response.error) {
      console.error("Error sending email to receiver:", response.error);
      console.error("Response error details:", JSON.stringify(response.error, null, 2));
      return false;
    }
    
    console.log("Email sent successfully to receiver:", order.receiver.email, "Response:", JSON.stringify(response.data));
    return true;
  } catch (error) {
    console.error("Failed to send email to receiver:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return false;
  }
};

export const sendBusinessAccountCreationEmail = async (email: string, name: string): Promise<boolean> => {
  try {
    console.log("Sending business account creation confirmation email to:", email);
    
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: email,
        subject: "Your Business Account Application",
        text: `Hello ${name},

Thank you for creating a business account with The Cycle Courier Co.

Your account is currently pending approval, which typically takes place within 24 hours. Once approved, you'll receive another email confirming you can access your account.

If you have any questions in the meantime, please don't hesitate to contact our support team.

Thank you for choosing The Cycle Courier Co.
        `,
        from: "Ccc@notification.cyclecourierco.com"
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

export const sendAccountApprovalEmail = async (email: string, name: string, companyName?: string): Promise<boolean> => {
  try {
    console.log("Sending account approval email to:", email);
    
    const greeting = companyName 
      ? `Hello ${name} at ${companyName},` 
      : `Hello ${name},`;
    
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: email,
        subject: "Your Business Account Has Been Approved",
        text: `${greeting}

Great news! Your business account with The Cycle Courier Co. has been approved.

You can now log in to your account and start creating orders. Our platform offers a range of features to help manage your deliveries efficiently.

If you have any questions or need assistance getting started, please don't hesitate to contact our support team.

Thank you for choosing The Cycle Courier Co.
        `,
        from: "Ccc@notification.cyclecourierco.com"
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
