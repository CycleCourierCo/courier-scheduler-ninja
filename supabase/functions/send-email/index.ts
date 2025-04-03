
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

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Ensure API key is available
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
    
    // Initialize Resend with API key
    const resend = new Resend(RESEND_API_KEY);
    
    // Get the request body
    const reqData = await req.json();
    console.log('Request data:', reqData);

    // Check for special internal actions like delivery confirmation
    if (reqData.meta && reqData.meta.action === "delivery_confirmation") {
      console.log("Processing delivery confirmation action for order:", reqData.meta.orderId);
      return await handleDeliveryConfirmation(reqData.meta.orderId, resend);
    }

    // Validate required fields
    if (!reqData.to) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: to' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Set default from if not provided
    const from = reqData.from || "Ccc@notification.cyclecourierco.com";
    
    // Build the email options
    const emailOptions = {
      from,
      to: reqData.to,
    };
    
    // Handle different email types
    if (reqData.emailType === 'sender' || reqData.emailType === 'receiver') {
      // For sender/receiver availability emails
      const baseUrl = reqData.baseUrl || '';
      const orderId = reqData.orderId || '';
      const name = reqData.name || 'Customer';
      const item = reqData.item || { name: 'Bicycle', quantity: 1 };
      
      // Different messages based on sender/receiver role
      let actionType = '';
      let introMessage = '';
      
      if (reqData.emailType === 'sender') {
        actionType = 'pickup';
        introMessage = 'We need to confirm your availability for us to collect a bicycle from you:';
      } else {
        actionType = 'delivery';
        introMessage = 'We need to confirm your availability for the delivery of a bicycle to you:';
      }
      
      // FIXED URL CONSTRUCTION: Using the correct paths that match our routes
      const availabilityUrl = `${baseUrl}/${reqData.emailType}-availability/${orderId}`;
      
      emailOptions.subject = `Please confirm your ${actionType} availability`;
      emailOptions.html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${name},</h2>
          <p>Thank you for using The Cycle Courier Co.</p>
          <p>${introMessage}</p>
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
      emailOptions.text = `
Hello ${name},

Thank you for using The Cycle Courier Co.

${introMessage}
${item.name} (Quantity: ${item.quantity})

Please visit the following link to confirm your availability:
${availabilityUrl}

Thank you,
The Cycle Courier Co. Team
      `;
    } else {
      // For standard emails
      emailOptions.subject = reqData.subject || 'Notification from The Cycle Courier Co.';
      emailOptions.text = reqData.text || '';
      if (reqData.html) {
        emailOptions.html = reqData.html;
      }
    }
    
    console.log(`Sending email from: ${from} to: ${reqData.to}`);
    console.log(`Email subject: ${emailOptions.subject}`);

    // Send the email
    const { data, error } = await resend.emails.send(emailOptions);

    if (error) {
      console.error('Resend error:', error);
      throw error;
    }

    console.log('Email sent successfully:', data);
    
    return new Response(
      JSON.stringify({ data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

// Helper function to handle delivery confirmation emails
async function handleDeliveryConfirmation(orderId: string, resend: any): Promise<Response> {
  try {
    console.log("Starting delivery confirmation process for order:", orderId);
    
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get order details
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
    
    // Prepare email content
    const trackingUrl = `https://cyclecourierco.com/tracking/${order.tracking_number}`;
    const reviewLinks = {
      trustpilot: "https://www.trustpilot.com/review/cyclecourierco.com",
      facebook: "https://www.facebook.com/people/The-Cycle-Courier-Co/61573561676506"
    };
    
    const itemName = `${order.bike_brand || ""} ${order.bike_model || ""}`.trim() || "Bicycle";
    
    let senderSent = false;
    let receiverSent = false;
    
    // Send confirmation to sender
    if (order.sender && order.sender.email) {
      console.log("Sending delivery confirmation to sender:", order.sender.email);
      
      const senderHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${order.sender.name || "Customer"},</h2>
          <p>Great news! Your bicycle has been successfully delivered.</p>
          <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Bicycle:</strong> ${itemName}</p>
            <p><strong>Tracking Number:</strong> ${order.tracking_number}</p>
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
      `;
      
      try {
        const { data: senderData, error: senderError } = await resend.emails.send({
          from: "Ccc@notification.cyclecourierco.com",
          to: order.sender.email,
          subject: "Your Bicycle Has Been Delivered - The Cycle Courier Co.",
          html: senderHtml
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
    
    // Send confirmation to receiver
    if (order.receiver && order.receiver.email) {
      console.log("Sending delivery confirmation to receiver:", order.receiver.email);
      
      const receiverHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${order.receiver.name || "Customer"},</h2>
          <p>Great news! Your bicycle has been successfully delivered to you.</p>
          <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Bicycle:</strong> ${itemName}</p>
            <p><strong>Tracking Number:</strong> ${order.tracking_number}</p>
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
      `;
      
      try {
        const { data: receiverData, error: receiverError } = await resend.emails.send({
          from: "Ccc@notification.cyclecourierco.com",
          to: order.receiver.email,
          subject: "Your Bicycle Has Been Delivered - The Cycle Courier Co.",
          html: receiverHtml
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
