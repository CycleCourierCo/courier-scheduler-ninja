
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

// Get the API key from environment variable
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Set up CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Define the request handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const { to, subject, text, html, name, orderId, baseUrl, emailType, item } = await req.json();

    // Handle different email types
    if (emailType === "sender" || emailType === "receiver") {
      // This is for availability emails
      const availabilityLink = `${baseUrl}/${emailType === "sender" ? "sender" : "receiver"}-availability/${orderId}`;
      const emailTitle = emailType === "sender" ? "Collection Availability" : "Delivery Availability";
      
      const { data, error } = await resend.emails.send({
        from: "Cycle Courier <notifications@cyclecourierco.com>",
        to: [to],
        subject: `Cycle Courier: Please Confirm Your ${emailTitle}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Hello ${name},</h1>
            <p>You have a ${item.name} ${emailType === "sender" ? "to be collected" : "being delivered to you"}.</p>
            <p>Please click the link below to confirm your availability:</p>
            <a href="${availabilityLink}" style="display: inline-block; background-color: #0e7490; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin: 20px 0;">
              Confirm Your Availability
            </a>
            <p>If the button doesn't work, copy and paste this URL into your browser:</p>
            <p style="word-break: break-all;">${availabilityLink}</p>
            <p>Thank you,<br>The Cycle Courier Team</p>
          </div>
        `,
      });

      if (error) throw error;
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    // For general purpose emails (account approvals, etc.)
    const { data, error } = await resend.emails.send({
      from: "Cycle Courier <notifications@cyclecourierco.com>",
      to: [to],
      subject: subject,
      html: html || `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Hello${name ? ' ' + name : ''},</h1>
          <p>${text}</p>
          <p>Thank you,<br>The Cycle Courier Team</p>
        </div>
      `,
      text: text,
    });

    if (error) throw error;
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
