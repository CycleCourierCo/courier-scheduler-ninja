
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const resend = new Resend(RESEND_API_KEY);

    // Parse request body
    const { to, name, orderId, baseUrl } = await req.json();

    if (!to || !name || !orderId || !baseUrl) {
      throw new Error("Missing required fields: to, name, orderId, or baseUrl");
    }

    console.log(`Sending email to ${to} for order ${orderId}`);

    // Generate the availability link
    const availabilityLink = `${baseUrl}/sender-availability/${orderId}`;

    // Set up the email
    const data = await resend.emails.send({
      from: "Ccc@notification.cyclecourierco.com",
      to: [to],
      subject: "Confirm Your Availability - Cycle Courier Co",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #374151;">Please Confirm Your Availability</h1>
          <p>Hello ${name},</p>
          <p>Thank you for using Cycle Courier Co for your delivery needs. To schedule a pickup for your package, please confirm your availability by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${availabilityLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Confirm Availability</a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p>${availabilityLink}</p>
          <p>Thank you,<br>The Cycle Courier Co Team</p>
        </div>
      `,
    });

    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
