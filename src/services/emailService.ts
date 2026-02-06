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

export const sendBusinessRegistrationAdminNotification = async (
  name: string,
  email: string,
  companyName: string,
  phone: string,
  website: string,
  address: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postalCode: string;
  }
): Promise<boolean> => {
  try {
    console.log("Sending business registration notification to admin");
    
    const approvalUrl = `${window.location.origin}/users`;
    const fullAddress = [
      address.addressLine1,
      address.addressLine2,
      address.city,
      address.postalCode
    ].filter(Boolean).join(", ");
    
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: "info@cyclecourierco.com",
        subject: "New Business Registration Requires Approval",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>New Business Registration</h2>
            <p>A new business account has been created and requires approval.</p>
            
            <div style="background-color: #f7f7f7; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Business Details</h3>
              <p><strong>Business Name:</strong> ${companyName}</p>
              <p><strong>Contact Person:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Phone:</strong> ${phone}</p>
              <p><strong>Website:</strong> ${website || 'Not provided'}</p>
              <p><strong>Address:</strong> ${fullAddress}</p>
              <p><strong>Registered At:</strong> ${new Date().toLocaleString('en-GB')}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${approvalUrl}" style="background-color: #4a65d5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Review & Approve Account
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Please review this application and approve or reject it from the admin dashboard.
            </p>
          </div>
        `,
        from: "Ccc@notification.cyclecourierco.com"
      }
    });
    
    if (response.error) {
      console.error("Error sending admin notification email:", response.error);
      return false;
    }
    
    console.log("Admin notification email sent successfully");
    return true;
  } catch (error) {
    console.error("Failed to send admin notification email:", error);
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
/**
export const sendDeliveryConfirmationToSender = async (id: string): Promise<boolean> => {
  try {
    console.log("Sending delivery confirmation email to sender for order ID:", id);
    
    // Get the order details first
    const order = await getOrder(id);
    
    // Ensure the order exists and has a sender
    if (!order || !order.sender || !order.sender.email) {
      console.error("Order or sender information not found for ID:", id);
      return false;
    }
    
    // Create item from bike details
    const item = {
      name: `${order.bikeBrand} ${order.bikeModel}`.trim(),
      quantity: 1,
      price: 0
    };

    const trackingUrl = `${window.location.origin}/tracking/${order.trackingNumber}`;
    const reviewLinks = {
      trustpilot: "https://www.trustpilot.com/review/cyclecourierco.com",
      facebook: "https://www.facebook.com/people/The-Cycle-Courier-Co/61573561676506"
    };
    
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: order.sender.email,
        subject: "Your Bicycle Has Been Delivered - The Cycle Courier Co.",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${order.sender.name},</h2>
            <p>Great news! Your bicycle has been successfully delivered.</p>
            <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Bicycle:</strong> ${item.name}</p>
              <p><strong>Tracking Number:</strong> ${order.trackingNumber}</p>
            </div>
            <p>You can view the complete delivery details by visiting:</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${trackingUrl}" style="background-color: #4a65d5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Delivery Details
              </a>
            </div>
            <p>We hope you enjoyed our service. Your feedback is important to us - it helps us improve!</p>
            <p>Please consider leaving us a review:</p>
            <div style="margin: 20px 0; display: flex; justify-content: center; gap: 10px;">
              <a href="${reviewLinks.trustpilot}" style="background-color: #00b67a; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Trustpilot
              </a>
              <a href="${reviewLinks.facebook}" style="background-color: #3b5998; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Facebook
              </a>
            </div>
            <p>Thank you for choosing The Cycle Courier Co.</p>
            <p>Best regards,<br>The Cycle Courier Co. Team</p>
          </div>
        `,
        from: "Ccc@notification.cyclecourierco.com"
      }
    });
    
    if (response.error) {
      console.error("Error sending delivery confirmation email to sender:", response.error);
      return false;
    }
    
    console.log("Delivery confirmation email sent successfully to sender:", order.sender.email);
    return true;
  } catch (error) {
    console.error("Failed to send delivery confirmation email to sender:", error);
    return false;
  }
};

export const sendDeliveryConfirmationToReceiver = async (id: string): Promise<boolean> => {
  try {
    console.log("Sending delivery confirmation email to receiver for order ID:", id);
    
    // Get the order details first
    const order = await getOrder(id);
    
    // Ensure the order exists and has a receiver
    if (!order || !order.receiver || !order.receiver.email) {
      console.error("Order or receiver information not found for ID:", id);
      return false;
    }
    
    // Create item from bike details
    const item = {
      name: `${order.bikeBrand} ${order.bikeModel}`.trim(),
      quantity: 1,
      price: 0
    };

    const trackingUrl = `${window.location.origin}/tracking/${order.trackingNumber}`;
    const reviewLinks = {
      trustpilot: "https://www.trustpilot.com/review/cyclecourierco.com",
      facebook: "https://www.facebook.com/people/The-Cycle-Courier-Co/61573561676506"
    };
    
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: order.receiver.email,
        subject: "Your Bicycle Has Been Delivered - The Cycle Courier Co.",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${order.receiver.name},</h2>
            <p>Great news! Your bicycle has been successfully delivered to you.</p>
            <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Bicycle:</strong> ${item.name}</p>
              <p><strong>Tracking Number:</strong> ${order.trackingNumber}</p>
            </div>
            <p>You can view the complete delivery details by visiting:</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${trackingUrl}" style="background-color: #4a65d5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Delivery Details
              </a>
            </div>
            <p>We hope you enjoyed our service. Your feedback is important to us - it helps us improve!</p>
            <p>Please consider leaving us a review:</p>
            <div style="margin: 20px 0; display: flex; justify-content: center; gap: 10px;">
              <a href="${reviewLinks.trustpilot}" style="background-color: #00b67a; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Trustpilot
              </a>
              <a href="${reviewLinks.facebook}" style="background-color: #3b5998; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Facebook
              </a>
            </div>
            <p>Thank you for choosing The Cycle Courier Co.</p>
            <p>Best regards,<br>The Cycle Courier Co. Team</p>
          </div>
        `,
        from: "Ccc@notification.cyclecourierco.com"
      }
    });
    
    if (response.error) {
      console.error("Error sending delivery confirmation email to receiver:", response.error);
      return false;
    }
    
    console.log("Delivery confirmation email sent successfully to receiver:", order.receiver.email);
    return true;
  } catch (error) {
    console.error("Failed to send delivery confirmation email to receiver:", error);
    return false;
  }
};
*/
export const sendSenderAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    console.log("Starting to send sender availability email for order ID:", id);
    
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
    
    console.log("Sending sender availability email to:", order.sender.email);
    
    // Send email to sender with improved error handling
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: order.sender.email,
        name: order.sender.name || "Sender",
        orderId: id,
        baseUrl,
        emailType: "sender",
        item: item,
        trackingNumber: order.trackingNumber
      }
    });
    
    if (response.error) {
      console.error("Error sending email to sender:", response.error);
      console.error("Response error details:", JSON.stringify(response.error, null, 2));
      return false;
    }
    
    console.log("Email sent successfully to sender:", order.sender.email, "Response:", JSON.stringify(response.data));
    return true;
  } catch (error) {
    console.error("Failed to send email to sender:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return false;
  }
};

export const resendSenderAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    console.log("Attempting to resend sender availability email for order ID:", id);
    return await sendSenderAvailabilityEmail(id);
  } catch (error) {
    console.error("Error resending sender availability email:", error);
    return false;
  }
};

export const sendReceiverAvailabilityEmail = async (id: string): Promise<boolean> => {
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
    
    console.log("Sending receiver availability email to:", order.receiver.email);
    
    // Send email to receiver with improved error handling
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: order.receiver.email,
        name: order.receiver.name || "Receiver",
        orderId: id,
        baseUrl,
        emailType: "receiver",
        item: item,
        trackingNumber: order.trackingNumber
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

export const resendReceiverAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    console.log("Attempting to resend receiver availability email for order ID:", id);
    return await sendReceiverAvailabilityEmail(id);
  } catch (error) {
    console.error("Error resending receiver availability email:", error);
    return false;
  }
};

// === NEW FUNCTION: Send confirmation to user (not sender/receiver) ===
export const sendOrderCreationConfirmationToUser = async (
  orderId: string,
  email: string,
  name: string
): Promise<boolean> => {
  try {
    console.log("Sending order creation confirmation email to order creator (user) for order ID:", orderId);
    if (!email) {
      console.error("No user email provided for confirmation email!");
      return false;
    }
    // Get order details for order/tracking number
    const order = await getOrder(orderId);

    const item = {
      name: `${order?.bikeBrand || ""} ${order?.bikeModel || ""}`.trim() || "Bicycle",
      quantity: 1,
      price: 0
    };

    const trackingNumber = order?.trackingNumber || orderId;
    const trackingUrl = `${window.location.origin}/tracking/${trackingNumber}`;

    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: email,
        subject: "Your Order Has Been Created - The Cycle Courier Co.",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${name},</h2>
            <p>Thank you for creating your order with The Cycle Courier Co.</p>
            <p>Your order has been successfully created. Here are the details:</p>
            <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Bicycle:</strong> ${item.name}</p>
              <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
            </div>
            <p>We will send further emails to arrange a collection date and delivery with the sender and receiver.</p>
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
      console.error("Error sending order creation confirmation email to user:", response.error);
      return false;
    }
    console.log("Order confirmation email sent successfully to user:", email);
    return true;
  } catch (error) {
    console.error("Failed to send order creation confirmation email to user:", error);
    return false;
  }
};

/**
 * Sends cancellation emails to order creator, sender, and receiver
 * @param orderId The ID of the cancelled order
 */
export const sendOrderCancellationEmails = async (orderId: string): Promise<{
  creatorSent: boolean;
  senderSent: boolean;
  receiverSent: boolean;
}> => {
  try {
    console.log("Sending order cancellation emails for order ID:", orderId);
    
    // Get the order details and creator profile
    const order = await getOrder(orderId);
    
    if (!order) {
      console.error("Order not found for ID:", orderId);
      return { creatorSent: false, senderSent: false, receiverSent: false };
    }

    // Fetch the creator's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('id', order.user_id)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
    }

    const results = {
      creatorSent: false,
      senderSent: false,
      receiverSent: false,
    };

    const bikeName = `${order.bikeBrand || ''} ${order.bikeModel || 'Bicycle'}`.trim();
    const trackingNumber = order.trackingNumber || orderId;
    const customerOrderNumber = order.customerOrderNumber ? `\n- Customer Order Number: ${order.customerOrderNumber}` : '';

    // Send email to order creator
    if (profile?.email) {
      try {
        console.log("Sending cancellation email to order creator:", profile.email);
        const response = await supabase.functions.invoke("send-email", {
          body: {
            to: profile.email,
            subject: `Order Cancelled - ${trackingNumber}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Dear ${profile.name || 'Customer'},</h2>
                <p>Your bicycle delivery order has been cancelled.</p>
                <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <p><strong>Order Details:</strong></p>
                  <p>- Tracking Number: ${trackingNumber}${customerOrderNumber}</p>
                  <p>- Bicycle: ${bikeName}</p>
                </div>
                <p>If you have any questions about this cancellation, please contact our support team.</p>
                <p>Best regards,<br>The Cycle Courier Co. Team</p>
              </div>
            `,
            from: "Ccc@notification.cyclecourierco.com"
          }
        });
        
        if (!response.error) {
          results.creatorSent = true;
          console.log("Cancellation email sent to creator successfully");
        } else {
          console.error("Error sending email to creator:", response.error);
        }
      } catch (error) {
        console.error("Failed to send email to creator:", error);
      }
    }

    // Send email to sender
    if (order.sender?.email) {
      try {
        console.log("Sending cancellation email to sender:", order.sender.email);
        const response = await supabase.functions.invoke("send-email", {
          body: {
            to: order.sender.email,
            subject: `Order Cancelled - ${trackingNumber}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Dear ${order.sender.name || 'Customer'},</h2>
                <p>Your bicycle delivery order has been cancelled.</p>
                <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <p><strong>Order Details:</strong></p>
                  <p>- Tracking Number: ${trackingNumber}${customerOrderNumber}</p>
                  <p>- Bicycle: ${bikeName}</p>
                </div>
                <p>If you have any questions about this cancellation, please contact our support team.</p>
                <p>Best regards,<br>The Cycle Courier Co. Team</p>
              </div>
            `,
            from: "Ccc@notification.cyclecourierco.com"
          }
        });
        
        if (!response.error) {
          results.senderSent = true;
          console.log("Cancellation email sent to sender successfully");
        } else {
          console.error("Error sending email to sender:", response.error);
        }
      } catch (error) {
        console.error("Failed to send email to sender:", error);
      }
    }

    // Send email to receiver
    if (order.receiver?.email) {
      try {
        console.log("Sending cancellation email to receiver:", order.receiver.email);
        const response = await supabase.functions.invoke("send-email", {
          body: {
            to: order.receiver.email,
            subject: `Order Cancelled - ${trackingNumber}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Dear ${order.receiver.name || 'Customer'},</h2>
                <p>Your bicycle delivery order has been cancelled.</p>
                <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <p><strong>Order Details:</strong></p>
                  <p>- Tracking Number: ${trackingNumber}${customerOrderNumber}</p>
                  <p>- Bicycle: ${bikeName}</p>
                </div>
                <p>If you have any questions about this cancellation, please contact our support team.</p>
                <p>Best regards,<br>The Cycle Courier Co. Team</p>
              </div>
            `,
            from: "Ccc@notification.cyclecourierco.com"
          }
        });
        
        if (!response.error) {
          results.receiverSent = true;
          console.log("Cancellation email sent to receiver successfully");
        } else {
          console.error("Error sending email to receiver:", response.error);
        }
      } catch (error) {
        console.error("Failed to send email to receiver:", error);
      }
    }

    console.log("Cancellation emails sent:", results);
    return results;
  } catch (error) {
    console.error("Failed to send order cancellation emails:", error);
    return { creatorSent: false, senderSent: false, receiverSent: false };
  }
};
