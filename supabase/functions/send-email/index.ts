import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";

// Email sender address
const DEFAULT_FROM_EMAIL = "Ccc@notification.cyclecourierco.com";

// Email templates
const EMAIL_TEMPLATES = {
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY environment variable is not set');
      return new Response(
        JSON.stringify({ error: 'API key is missing' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }
    
    const resend = new Resend(RESEND_API_KEY);
    
    // Parse request data and log it
    const reqData = await req.json();
    console.log('Request data:', JSON.stringify(reqData, null, 2));
    
    // Handle special actions
    if (reqData.meta && reqData.meta.action === "delivery_confirmation") {
      console.log("Processing delivery confirmation action for order:", reqData.meta.orderId);
      return await handleDeliveryConfirmation(reqData.meta.orderId, resend);
    }

    // Validate to field is present
    if (!reqData.to) {
      console.error('Missing required "to" field in email request');
      return new Response(
        JSON.stringify({ error: 'Missing required "to" field in email request' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Prepare email options with default values
    const emailOptions = {
      from: reqData.from || DEFAULT_FROM_EMAIL,
      to: reqData.to,
    };
    
    // If email type is specified, generate the email content accordingly
    if (reqData.emailType) {
      console.log(`Generating email template for type: ${reqData.emailType}`);
      
      // Get the email subject and content based on template type
      const emailContent = await generateEmailContent(reqData);
      
      emailOptions.subject = emailContent.subject;
      emailOptions.html = emailContent.html;
      emailOptions.text = emailContent.text;
    } else {
      // If no template specified, use provided content directly
      emailOptions.subject = reqData.subject || 'Notification from The Cycle Courier Co.';
      emailOptions.text = reqData.text || '';
      if (reqData.html) {
        emailOptions.html = reqData.html;
      }
    }
    
    console.log(`Sending email from: ${emailOptions.from} to: ${emailOptions.to}`);
    console.log(`Email subject: ${emailOptions.subject}`);

    // Attempt to send the email
    try {
      const { data, error } = await resend.emails.send(emailOptions);

      if (error) {
        console.error('Resend error:', error);
        throw error;
      }

      console.log('Email sent successfully:', data);
      
      return new Response(
        JSON.stringify({ data, success: true }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } catch (sendError) {
      console.error('Error sending email via Resend:', sendError);
      return new Response(
        JSON.stringify({ error: sendError.message || 'Failed to send email via Resend API' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }
  } catch (error) {
    console.error('General error in send-email function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
        }
      );
  }
});

// Function to generate email content based on type and data
async function generateEmailContent(data) {
  const baseUrl = data.baseUrl || '';
  const name = data.name || 'Customer';
  const item = data.item || { name: 'Bicycle', quantity: 1 };
  
  // Default email content
  let subject = 'Notification from The Cycle Courier Co.';
  let html = `<p>Hello ${name},</p><p>This is a notification from The Cycle Courier Co.</p>`;
  let text = `Hello ${name},\n\nThis is a notification from The Cycle Courier Co.`;

  // Get order details if orderId is provided
  let order = null;
  if (data.orderId) {
    order = await getOrderDetails(data.orderId);
    console.log("Order details retrieved:", JSON.stringify(order, null, 2));
  }
  
  // Generate content based on email type
  switch (data.emailType) {
    case EMAIL_TEMPLATES.BUSINESS_ACCOUNT_CREATED:
      subject = "Your Business Account Application";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${name},</h2>
          <p>Thank you for creating a business account with The Cycle Courier Co.</p>
          <p>Your account is currently pending approval, which typically takes place within 24 hours. Once approved, you'll receive another email confirming you can access your account.</p>
          <p>If you have any questions in the meantime, please don't hesitate to contact our support team.</p>
          <p>Thank you for choosing The Cycle Courier Co.</p>
        </div>
      `;
      text = `
Hello ${name},

Thank you for creating a business account with The Cycle Courier Co.

Your account is currently pending approval, which typically takes place within 24 hours. Once approved, you'll receive another email confirming you can access your account.

If you have any questions in the meantime, please don't hesitate to contact our support team.

Thank you for choosing The Cycle Courier Co.
      `;
      break;

    case EMAIL_TEMPLATES.BUSINESS_ACCOUNT_APPROVED:
      const companyName = data.companyName || '';
      const greeting = companyName 
        ? `Hello ${name} at ${companyName},` 
        : `Hello ${name},`;
      
      subject = "Your Business Account Has Been Approved";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${greeting}</h2>
          <p>Great news! Your business account with The Cycle Courier Co. has been approved.</p>
          <p>You can now log in to your account and start creating orders. Our platform offers a range of features to help manage your deliveries efficiently.</p>
          <p>If you have any questions or need assistance getting started, please don't hesitate to contact our support team.</p>
          <p>Thank you for choosing The Cycle Courier Co.</p>
        </div>
      `;
      text = `
${greeting}

Great news! Your business account with The Cycle Courier Co. has been approved.

You can now log in to your account and start creating orders. Our platform offers a range of features to help manage your deliveries efficiently.

If you have any questions or need assistance getting started, please don't hesitate to contact our support team.

Thank you for choosing The Cycle Courier Co.
      `;
      break;

    case EMAIL_TEMPLATES.BUSINESS_ACCOUNT_REJECTED:
      subject = "Your Business Account Application Status";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${name},</h2>
          <p>Thank you for your interest in creating a business account with The Cycle Courier Co.</p>
          <p>After reviewing your application, we regret to inform you that we are unable to approve your business account at this time.</p>
          <p>If you have any questions or would like more information about this decision, please contact our support team.</p>
          <p>Thank you for your understanding.</p>
          <p>The Cycle Courier Co. Team</p>
        </div>
      `;
      text = `
Hello ${name},

Thank you for your interest in creating a business account with The Cycle Courier Co.

After reviewing your application, we regret to inform you that we are unable to approve your business account at this time.

If you have any questions or would like more information about this decision, please contact our support team.

Thank you for your understanding.

The Cycle Courier Co. Team
      `;
      break;

    case EMAIL_TEMPLATES.ORDER_CREATED_SENDER:
      if (!order) {
        throw new Error("Order details are required for order created emails");
      }
      
      const itemName = `${order.bike_brand || ""} ${order.bike_model || ""}`.trim() || "Bicycle";
      const trackingUrl = `${baseUrl}/tracking/${order.tracking_number}`;
      
      subject = "Thank You for Your Order - The Cycle Courier Co.";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${order.sender.name},</h2>
          <p>Thank you for choosing The Cycle Courier Co.</p>
          <p>Your order has been successfully created. Here are the details:</p>
          <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Bicycle:</strong> ${itemName}</p>
            <p><strong>Tracking Number:</strong> ${order.tracking_number}</p>
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
      `;
      text = `
Hello ${order.sender.name},

Thank you for choosing The Cycle Courier Co.

Your order has been successfully created. Here are the details:

Bicycle: ${itemName}
Tracking Number: ${order.tracking_number}

We have sent you a separate email to arrange a collection date. Please check your inbox and confirm your availability as soon as possible.

You can track your order's progress by visiting: ${trackingUrl}

Thank you for using our service.

The Cycle Courier Co. Team
      `;
      break;

    case EMAIL_TEMPLATES.ORDER_CREATED_RECEIVER:
      if (!order) {
        throw new Error("Order details are required for order created emails");
      }
      
      const receiverItemName = `${order.bike_brand || ""} ${order.bike_model || ""}`.trim() || "Bicycle";
      const receiverTrackingUrl = `${baseUrl}/tracking/${order.tracking_number}`;
      
      subject = "Your Bicycle Delivery - The Cycle Courier Co.";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${order.receiver.name},</h2>
          <p>A bicycle is being sent to you via The Cycle Courier Co.</p>
          <p>Here are the details:</p>
          <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Bicycle:</strong> ${receiverItemName}</p>
            <p><strong>Tracking Number:</strong> ${order.tracking_number}</p>
          </div>
          <p><strong>Next Steps:</strong></p>
          <ol style="margin-bottom: 20px;">
            <li>We have contacted the sender to arrange a collection date.</li>
            <li>Once the sender confirms their availability, <strong>you will receive an email with a link to confirm your availability for delivery</strong>.</li>
            <li>After both confirmations, we will schedule the pickup and delivery.</li>
          </ol>
          <p>You can track the order's progress by visiting:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${receiverTrackingUrl}" style="background-color: #4a65d5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Track This Order
            </a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #4a65d5;">${receiverTrackingUrl}</p>
          <p>Thank you for using our service.</p>
          <p>The Cycle Courier Co. Team</p>
        </div>
      `;
      text = `
Hello ${order.receiver.name},

A bicycle is being sent to you via The Cycle Courier Co.

Here are the details:

Bicycle: ${receiverItemName}
Tracking Number: ${order.tracking_number}

Next Steps:
1. We have contacted the sender to arrange a collection date.
2. Once the sender confirms their availability, you will receive an email with a link to confirm your availability for delivery.
3. After both confirmations, we will schedule the pickup and delivery.

You can track the order's progress by visiting: ${receiverTrackingUrl}

Thank you for using our service.

The Cycle Courier Co. Team
      `;
      break;

    case "sender":  // SENDER_AVAILABILITY 
    case EMAIL_TEMPLATES.SENDER_AVAILABILITY:
      const availabilityUrl = `${baseUrl}/sender-availability/${data.orderId}`;
      
      subject = "Please confirm your pickup availability";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${name},</h2>
          <p>Thank you for using The Cycle Courier Co.</p>
          <p>We need to confirm your availability for the pickup of your item:</p>
          <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>${item.name}</strong> (Quantity: ${item.quantity})</p>
          </div>
          <p>Please click the button below to confirm your availability:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${availabilityUrl}" style="background-color: #4a65d5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Confirm Availability
            </a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #4a65d5;">${availabilityUrl}</p>
          <p>Thank you,<br>The Cycle Courier Co. Team</p>
        </div>
      `;
      text = `
Hello ${name},

Thank you for using The Cycle Courier Co.

We need to confirm your availability for the pickup of your item:
${item.name} (Quantity: ${item.quantity})

Please visit the following link to confirm your availability:
${availabilityUrl}

Thank you,
The Cycle Courier Co. Team
      `;
      break;

    case "receiver":  // RECEIVER_AVAILABILITY
    case EMAIL_TEMPLATES.RECEIVER_AVAILABILITY:
      const receiverAvailabilityUrl = `${baseUrl}/receiver-availability/${data.orderId}`;
      
      subject = "Please confirm your delivery availability";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${name},</h2>
          <p>Thank you for using The Cycle Courier Co.</p>
          <p>We need to confirm your availability for the delivery of your item:</p>
          <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>${item.name}</strong> (Quantity: ${item.quantity})</p>
          </div>
          <p>Please click the button below to confirm your availability:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${receiverAvailabilityUrl}" style="background-color: #4a65d5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Confirm Availability
            </a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #4a65d5;">${receiverAvailabilityUrl}</p>
          <p>Thank you,<br>The Cycle Courier Co. Team</p>
        </div>
      `;
      text = `
Hello ${name},

Thank you for using The Cycle Courier Co.

We need to confirm your availability for the delivery of your item:
${item.name} (Quantity: ${item.quantity})

Please visit the following link to confirm your availability:
${receiverAvailabilityUrl}

Thank you,
The Cycle Courier Co. Team
      `;
      break;

    case EMAIL_TEMPLATES.DELIVERY_CONFIRMATION:
      if (!order) {
        throw new Error("Order details are required for delivery confirmation emails");
      }
      
      const confirmItemName = `${order.bike_brand || ""} ${order.bike_model || ""}`.trim() || "Bicycle";
      const confirmTrackingUrl = `${baseUrl}/tracking/${order.tracking_number}`;
      const reviewLinks = {
        trustpilot: "https://www.trustpilot.com/review/cyclecourierco.com",
        facebook: "https://www.facebook.com/people/The-Cycle-Courier-Co/61573561676506"
      };
      
      const isReceiver = data.recipient === "receiver";
      const deliveryText = isReceiver ? "to you" : "";
      const personName = isReceiver ? order.receiver.name : order.sender.name;
      
      subject = "Your Bicycle Has Been Delivered - The Cycle Courier Co.";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${personName},</h2>
          <p>Great news! Your bicycle has been successfully delivered${deliveryText}.</p>
          <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Bicycle:</strong> ${confirmItemName}</p>
            <p><strong>Tracking Number:</strong> ${order.tracking_number}</p>
          </div>
          <p>You can view the complete delivery details by visiting:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${confirmTrackingUrl}" style="background-color: #4a65d5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
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
      `;
      text = `
Hello ${personName},

Great news! Your bicycle has been successfully delivered${deliveryText}.

Bicycle: ${confirmItemName}
Tracking Number: ${order.tracking_number}

You can view the complete delivery details by visiting: ${confirmTrackingUrl}

We hope you enjoyed our service. Your feedback is important to us - it helps us improve!

Please consider leaving us a review on Trustpilot (${reviewLinks.trustpilot}) or Facebook (${reviewLinks.facebook}).

Thank you for choosing The Cycle Courier Co.

Best regards,
The Cycle Courier Co. Team
      `;
      break;
  }

  return { subject, html, text };
}

// Helper function to get order details
async function getOrderDetails(orderId) {
  try {
    console.log("Fetching order details for order ID:", orderId);
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    
    if (error) {
      console.error("Error fetching order details:", error);
      throw error;
    }
    
    if (!data) {
      throw new Error(`Order with ID ${orderId} not found`);
    }
    
    console.log("Successfully fetched order details");
    return data;
  } catch (error) {
    console.error("Failed to fetch order details:", error);
    throw error;
  }
}

async function handleDeliveryConfirmation(orderId, resend) {
  try {
    console.log("Starting delivery confirmation process for order:", orderId);
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    
    if (error || !order) {
      console.error("Error fetching order details for email:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch order details" }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      );
    }
    
    // Ensure sender and receiver emails are present
    if (!order.sender || !order.sender.email) {
      console.error("Sender email is missing from order:", orderId);
      return new Response(
        JSON.stringify({ error: "Sender email is missing from order" }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }
    
    if (!order.receiver || !order.receiver.email) {
      console.error("Receiver email is missing from order:", orderId);
      return new Response(
        JSON.stringify({ error: "Receiver email is missing from order" }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }
    
    const trackingUrl = `https://cyclecourierco.com/tracking/${order.tracking_number}`;
    const itemName = `${order.bike_brand || ""} ${order.bike_model || ""}`.trim() || "Bicycle";
    
    let senderSent = false;
    let receiverSent = false;
    
    if (order.sender && order.sender.email) {
      console.log("Sending delivery confirmation to sender:", order.sender.email);
      
      try {
        const emailContent = await generateEmailContent({
          emailType: EMAIL_TEMPLATES.DELIVERY_CONFIRMATION,
          recipient: "sender",
          orderId: order.id,
          baseUrl: "https://cyclecourierco.com"
        });
        
        const { data: senderData, error: senderError } = await resend.emails.send({
          from: DEFAULT_FROM_EMAIL,
          to: order.sender.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        });
        
        if (senderError) {
          console.error("Error sending email to sender:", senderError);
        } else {
          console.log("Successfully sent delivery confirmation to sender");
          senderSent = true;
        }
      } catch (e) {
        console.error("Exception sending sender email:", e);
      }
    }
    
    if (order.receiver && order.receiver.email) {
      console.log("Sending delivery confirmation to receiver:", order.receiver.email);
      
      try {
        const emailContent = await generateEmailContent({
          emailType: EMAIL_TEMPLATES.DELIVERY_CONFIRMATION,
          recipient: "receiver",
          orderId: order.id,
          baseUrl: "https://cyclecourierco.com"
        });
        
        const { data: receiverData, error: receiverError } = await resend.emails.send({
          from: DEFAULT_FROM_EMAIL,
          to: order.receiver.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        });
        
        if (receiverError) {
          console.error("Error sending email to receiver:", receiverError);
        } else {
          console.log("Successfully sent delivery confirmation to receiver");
          receiverSent = true;
        }
      } catch (e) {
        console.error("Exception sending receiver email:", e);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        senderSent,
        receiverSent,
        message: "Delivery confirmation emails processing completed" 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error("Error in handleDeliveryConfirmation:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send delivery confirmation emails" }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}
