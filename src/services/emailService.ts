
import { supabase } from "@/integrations/supabase/client";
import { getOrder } from "./orderService";

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

export const sendOrderCreationEmailToSender = async (id: string): Promise<boolean> => {
  try {
    console.log("Sending order creation confirmation email to sender for order ID:", id);
    
    // Get the order details first
    const order = await getOrder(id);
    
    // Ensure the order exists and has a sender
    if (!order || !order.sender || !order.sender.email) {
      console.error("Order or sender information not found for ID:", id);
      return false;
    }
    
    // Create item from bike details
    const item = {
      name: `${order.bikeBrand} ${order.bikeModel}`.trim() || "Bicycle",
      quantity: 1,
      price: 0
    };

    // Fix: Use the actual tracking number from the order object
    const trackingNumber = order.trackingNumber || id;
    const trackingUrl = `${window.location.origin}/tracking/${trackingNumber}`;
    
    console.log("About to send order creation email to sender:", order.sender.email);
    console.log("Using tracking number:", trackingNumber);
    console.log("Using tracking URL:", trackingUrl);
    
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: order.sender.email,
        subject: "Thank You for Your Order - The Cycle Courier Co.",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${order.sender.name},</h2>
            <p>Thank you for choosing The Cycle Courier Co.</p>
            <p>Your order has been successfully created. Here are the details:</p>
            <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Bicycle:</strong> ${item.name}</p>
              <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
            </div>
            <p><strong>We have sent you a separate email to arrange a collection date.</strong> Please check your inbox and confirm your availability as soon as possible.</p>
            <p>You can track your order's progress by visiting:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingUrl}" style="background-color: #4a65d5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Track Your Order
              </a>
            </div>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4a65d5;">${trackingUrl}</p>
            <p>Thank you for using our service.</p>
            <p>The Cycle Courier Co. Team</p>
          </div>
        `,
        from: "Ccc@notification.cyclecourierco.com"
      }
    });
    
    if (response.error) {
      console.error("Error sending order creation email to sender:", response.error);
      return false;
    }
    
    console.log("Order creation email sent successfully to sender:", order.sender.email);
    return true;
  } catch (error) {
    console.error("Failed to send order creation email to sender:", error);
    return false;
  }
};

export const sendOrderNotificationToReceiver = async (id: string): Promise<boolean> => {
  try {
    console.log("Sending order notification email to receiver for order ID:", id);
    
    // Get the order details first
    const order = await getOrder(id);
    
    // Ensure the order exists and has a receiver
    if (!order || !order.receiver || !order.receiver.email) {
      console.error("Order or receiver information not found for ID:", id);
      return false;
    }
    
    // Create item from bike details
    const item = {
      name: `${order.bikeBrand} ${order.bikeModel}`.trim() || "Bicycle",
      quantity: 1,
      price: 0
    };

    // Fix: Use the actual tracking number from the order object
    const trackingNumber = order.trackingNumber || id;
    const trackingUrl = `${window.location.origin}/tracking/${trackingNumber}`;
    
    console.log("About to send order notification email to receiver:", order.receiver.email);
    console.log("Using tracking number:", trackingNumber);
    console.log("Using tracking URL:", trackingUrl);
    
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: order.receiver.email,
        subject: "Your Bicycle Delivery - The Cycle Courier Co.",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${order.receiver.name},</h2>
            <p>A bicycle is being sent to you via The Cycle Courier Co.</p>
            <p>Here are the details:</p>
            <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Bicycle:</strong> ${item.name}</p>
              <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
            </div>
            <p><strong>Next Steps:</strong></p>
            <ol style="margin-bottom: 20px;">
              <li>We have contacted the sender to arrange a collection date.</li>
              <li>Once the sender confirms their availability, <strong>you will receive an email with a link to confirm your availability for delivery</strong>.</li>
              <li>After both confirmations, we will schedule the pickup and delivery.</li>
            </ol>
            <p>You can track the order's progress by visiting:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingUrl}" style="background-color: #4a65d5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Track This Order
              </a>
            </div>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4a65d5;">${trackingUrl}</p>
            <p>Thank you for using our service.</p>
            <p>The Cycle Courier Co. Team</p>
          </div>
        `,
        from: "Ccc@notification.cyclecourierco.com"
      }
    });
    
    if (response.error) {
      console.error("Error sending order notification email to receiver:", response.error);
      console.error("Response error details:", JSON.stringify(response.error, null, 2));
      return false;
    }
    
    console.log("Order notification email sent successfully to receiver:", order.receiver.email);
    return true;
  } catch (error) {
    console.error("Failed to send order notification email to receiver:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return false;
  }
};

// The delivery confirmation emails are handled by the send-email edge function
// Removing duplicate methods to avoid multiple emails

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
