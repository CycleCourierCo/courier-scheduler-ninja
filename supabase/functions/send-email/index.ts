
import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { Resend } from "npm:resend@1.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailParams {
  to: string;
  name: string;
  orderId: string;
  baseUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log request for debugging
    console.log("Received request:", req.method);
    
    const payload = await req.json();
    console.log("Request payload:", payload);
    
    const { to, name, orderId, baseUrl } = payload as EmailParams;
    const availabilityUrl = `${baseUrl}/sender-availability/${orderId}`;

    console.log("Sending email to:", to);
    console.log("Using Resend API Key:", Deno.env.get("RESEND_API_KEY") ? "Set" : "Not set");

    const { data, error } = await resend.emails.send({
      from: "Cycle Courier Co <notifications@cyclecourierco.com>",
      to: [to],
      subject: "Please Confirm Your Availability for Package Pickup",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb; margin-top: 40px; margin-bottom: 20px;">Hello ${name},</h1>
          <p style="font-size: 16px; line-height: 24px; margin-bottom: 20px;">Thank you for creating an order with our courier service. We need you to confirm when you will be available for package pickup.</p>
          <p style="font-size: 16px; line-height: 24px; margin-bottom: 20px;"><strong>You can now select multiple dates that work for you!</strong> This gives us more flexibility to schedule your pickup.</p>
          <div style="margin: 30px 0;">
            <a href="${availabilityUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Confirm Your Availability</a>
          </div>
          <p style="font-size: 16px; line-height: 24px; margin-bottom: 20px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="font-size: 14px; line-height: 20px; word-break: break-all; color: #6b7280; margin-bottom: 30px;">${availabilityUrl}</p>
          <p style="font-size: 16px; line-height: 24px; margin-bottom: 40px;">Thank you,<br>The Cycle Courier Team</p>
        </div>
      `,
    });

    if (error) {
      console.error("Error sending email:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Email sent successfully to:", to);
    
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error in send-email function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
