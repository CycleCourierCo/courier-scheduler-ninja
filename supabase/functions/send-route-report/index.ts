import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface StopResult {
  sequence: number;
  type: 'pickup' | 'delivery' | 'break';
  contactName: string;
  address: string;
  estimatedTime: string;
  bikesOnboard: number;
  bikeQuantity: number;
  trackingNumber?: string;
  bikeBrand?: string;
  bikeModel?: string;
  breakDuration?: number;
  breakType?: 'lunch' | 'stop';
  results: {
    whatsapp: { success: boolean; error?: string };
    shipday: { success: boolean; error?: string };
    email: { success: boolean; error?: string };
  };
}

interface RouteReportRequest {
  date: string;
  startTime: string;
  startingBikes: number;
  stops: StopResult[];
  summary: {
    totalStops: number;
    totalPickups: number;
    totalDeliveries: number;
    totalBreaks: number;
    whatsappSuccess: number;
    whatsappFailed: number;
    shipdaySuccess: number;
    shipdayFailed: number;
    emailSuccess: number;
    emailFailed: number;
  };
}

function getStatusIcon(success: boolean): string {
  return success ? '✅' : '❌';
}

function getTypeLabel(type: 'pickup' | 'delivery' | 'break'): string {
  switch (type) {
    case 'pickup': return '📥 Collection';
    case 'delivery': return '📦 Delivery';
    case 'break': return '☕ Break';
  }
}

function getTypeColor(type: 'pickup' | 'delivery' | 'break'): string {
  switch (type) {
    case 'pickup': return '#3b82f6'; // blue
    case 'delivery': return '#22c55e'; // green
    case 'break': return '#f97316'; // orange
  }
}

function buildEmailHTML(data: RouteReportRequest): string {
  const finalBikes = data.stops.length > 0 
    ? data.stops[data.stops.length - 1].bikesOnboard 
    : data.startingBikes;

  const stopsHtml = data.stops.map((stop) => {
    const statusHtml = stop.type === 'break' 
      ? '<span style="color: #9ca3af;">---</span>'
      : `
        <span title="WhatsApp">${getStatusIcon(stop.results.whatsapp.success)}</span>
        <span title="Shipday">${getStatusIcon(stop.results.shipday.success)}</span>
        <span title="Email">${getStatusIcon(stop.results.email.success)}</span>
      `;

    const bikeInfo = stop.type === 'break' 
      ? '' 
      : `<br><span style="font-size: 11px; color: #6b7280;">${stop.bikeBrand || ''} ${stop.bikeModel || ''}</span>`;

    const breakInfo = stop.type === 'break' 
      ? ` (${stop.breakDuration}min ${stop.breakType === 'lunch' ? '🍽️' : '☕'})` 
      : '';

    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px; text-align: center; font-weight: bold; color: #374151;">${stop.sequence}</td>
        <td style="padding: 12px 8px; text-align: center; font-family: monospace;">${stop.estimatedTime || '-'}</td>
        <td style="padding: 12px 8px;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background-color: ${getTypeColor(stop.type)}20; color: ${getTypeColor(stop.type)}; font-size: 12px; font-weight: 500;">
            ${getTypeLabel(stop.type)}${breakInfo}
          </span>
        </td>
        <td style="padding: 12px 8px;">
          <strong>${stop.contactName}</strong>${bikeInfo}
          <br><span style="font-size: 11px; color: #9ca3af;">${stop.address}</span>
          ${stop.trackingNumber ? `<br><span style="font-size: 10px; color: #6b7280;">📦 ${stop.trackingNumber}</span>` : ''}
        </td>
        <td style="padding: 12px 8px; text-align: center;">
          <span style="display: inline-block; padding: 4px 8px; border-radius: 50%; background-color: #dcfce7; color: #166534; font-weight: bold;">
            🚲 ${stop.bikesOnboard}
          </span>
        </td>
        <td style="padding: 12px 8px; text-align: center; font-size: 16px;">
          ${statusHtml}
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Route Report - ${data.date}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 900px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
    <h1 style="margin: 0 0 8px 0; font-size: 24px;">🚴 Route Report</h1>
    <p style="margin: 0; font-size: 18px; opacity: 0.9;">${data.date}</p>
    <div style="margin-top: 16px; display: flex; gap: 24px; flex-wrap: wrap;">
      <span style="background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 6px;">
        ⏰ Start: ${data.startTime}
      </span>
      <span style="background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 6px;">
        🚲 Starting Bikes: ${data.startingBikes}
      </span>
    </div>
  </div>

  <!-- Summary Stats -->
  <div style="background: white; padding: 20px; border-bottom: 1px solid #e5e7eb;">
    <h2 style="margin: 0 0 16px 0; font-size: 16px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Route Summary</h2>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; text-align: center;">
      <div style="background: #f3f4f6; padding: 12px; border-radius: 8px;">
        <div style="font-size: 24px; font-weight: bold; color: #374151;">${data.summary.totalStops}</div>
        <div style="font-size: 12px; color: #6b7280;">Total Stops</div>
      </div>
      <div style="background: #dbeafe; padding: 12px; border-radius: 8px;">
        <div style="font-size: 24px; font-weight: bold; color: #1d4ed8;">${data.summary.totalPickups}</div>
        <div style="font-size: 12px; color: #3b82f6;">Collections</div>
      </div>
      <div style="background: #dcfce7; padding: 12px; border-radius: 8px;">
        <div style="font-size: 24px; font-weight: bold; color: #166534;">${data.summary.totalDeliveries}</div>
        <div style="font-size: 12px; color: #22c55e;">Deliveries</div>
      </div>
      <div style="background: #ffedd5; padding: 12px; border-radius: 8px;">
        <div style="font-size: 24px; font-weight: bold; color: #9a3412;">${data.summary.totalBreaks}</div>
        <div style="font-size: 12px; color: #f97316;">Breaks</div>
      </div>
    </div>
  </div>

  <!-- Stops Table -->
  <div style="background: white; overflow-x: auto;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
          <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #6b7280;">#</th>
          <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #6b7280;">Time</th>
          <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #6b7280;">Type</th>
          <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #6b7280;">Contact / Address</th>
          <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #6b7280;">Bikes</th>
          <th style="padding: 12px 8px; text-align: center; font-weight: 600; color: #6b7280;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${stopsHtml}
      </tbody>
    </table>
  </div>

  <!-- Status Legend -->
  <div style="background: #f9fafb; padding: 12px 20px; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb;">
    <strong>Status Legend:</strong> WA = WhatsApp | SD = Shipday | EM = Email
  </div>

  <!-- Notification Summary -->
  <div style="background: white; padding: 20px; border-top: 1px solid #e5e7eb;">
    <h2 style="margin: 0 0 16px 0; font-size: 16px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Notification Summary</h2>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px;">
        <div style="font-size: 14px; font-weight: 600; color: #166534; margin-bottom: 4px;">📱 WhatsApp</div>
        <div style="font-size: 20px; font-weight: bold;">
          <span style="color: #22c55e;">${data.summary.whatsappSuccess} sent</span>
          ${data.summary.whatsappFailed > 0 ? `<span style="color: #ef4444; margin-left: 8px;">${data.summary.whatsappFailed} failed</span>` : ''}
        </div>
      </div>
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 16px; border-radius: 8px;">
        <div style="font-size: 14px; font-weight: 600; color: #1d4ed8; margin-bottom: 4px;">📍 Shipday</div>
        <div style="font-size: 20px; font-weight: bold;">
          <span style="color: #3b82f6;">${data.summary.shipdaySuccess} updated</span>
          ${data.summary.shipdayFailed > 0 ? `<span style="color: #ef4444; margin-left: 8px;">${data.summary.shipdayFailed} failed</span>` : ''}
        </div>
      </div>
      <div style="background: #fdf4ff; border: 1px solid #e9d5ff; padding: 16px; border-radius: 8px;">
        <div style="font-size: 14px; font-weight: 600; color: #7c3aed; margin-bottom: 4px;">📧 Email</div>
        <div style="font-size: 20px; font-weight: bold;">
          <span style="color: #8b5cf6;">${data.summary.emailSuccess} sent</span>
          ${data.summary.emailFailed > 0 ? `<span style="color: #ef4444; margin-left: 8px;">${data.summary.emailFailed} failed</span>` : ''}
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="background: #1f2937; padding: 20px; border-radius: 0 0 12px 12px; color: white; text-align: center;">
    <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">
      Final Bikes Onboard: 🚲 ${finalBikes}
    </div>
    <p style="margin: 0; font-size: 12px; opacity: 0.7;">
      Generated by Cycle Courier Co. Route Management System
    </p>
  </div>

</body>
</html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-route-report function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: RouteReportRequest = await req.json();
    console.log(`Generating route report for ${data.date} with ${data.stops.length} stops`);

    // Validate required fields
    if (!data.date || !data.stops) {
      throw new Error("Missing required fields: date and stops");
    }

    const emailHtml = buildEmailHTML(data);

    const emailResponse = await resend.emails.send({
      from: "Cycle Courier Co. <noreply@cyclecourierco.com>",
      to: ["info@cyclecourierco.com"],
      subject: `🚴 Route Report - ${data.date} | ${data.summary.totalStops} stops`,
      html: emailHtml,
    });

    console.log("Route report email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Route report sent successfully",
        emailId: emailResponse.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-route-report function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
