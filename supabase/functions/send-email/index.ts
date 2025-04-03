
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

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
      
      const availabilityType = reqData.emailType === 'sender' ? 'pickup' : 'delivery';
      
      // FIXED URL CONSTRUCTION: Using the correct paths that match our routes
      const availabilityUrl = `${baseUrl}/${reqData.emailType}-availability/${orderId}`;
      
      emailOptions.subject = `Please confirm your ${availabilityType} availability`;
      emailOptions.html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${name},</h2>
          <p>Thank you for using The Cycle Courier Co.</p>
          <p>We need to confirm your availability for the ${availabilityType} of your item:</p>
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

We need to confirm your availability for the ${availabilityType} of your item:
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
