

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type JobType = "pickup" | "delivery";

interface RelatedJob {
  orderId: string;
  jobType: JobType;
}

interface TimeslotRequest {
  orderId: string;
  recipientType: "sender" | "receiver";
  deliveryTime: string; // "HH:MM"
  customMessage?: string;
  relatedJobs?: RelatedJob[]; // ✅ Option A
}

function toUTCYYYYMMDD(dateStr: string): string {
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) throw new Error(`Invalid date: ${dateStr}`);
  return dt.toISOString().slice(0, 10);
}

function addMinutesToHHMM(timeHHMM: string, minutesToAdd: number) {
  const [h, m] = timeHHMM.split(":").map(Number);
  if (
    Number.isNaN(h) ||
    Number.isNaN(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    throw new Error(`Invalid time (HH:MM): ${timeHHMM}`);
  }

  const total = h * 60 + m + minutesToAdd;

  // how many days to roll (0 or 1 in our case, but supports more)
  const dayOffset = Math.floor(total / (24 * 60));
  const minsInDay = ((total % (24 * 60)) + 24 * 60) % (24 * 60);

  const hh = String(Math.floor(minsInDay / 60)).padStart(2, "0");
  const mm = String(minsInDay % 60).padStart(2, "0");

  return { hhmmss: `${hh}:${mm}:00`, dayOffset };
}

function addDaysToUTCYYYYMMDD(yyyyMmDd: string, days: number) {
  const [y, mo, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// Customer-facing scheduled date display (keeps your original approach)
function formatDateForCustomer(dateStr: string) {
  const date = new Date(dateStr);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const localDate = new Date(year, month, day);
  return localDate.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function safeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function normalizeAddress(contact: any): string {
  // Your sender/receiver JSON appears to contain: contact.address.street/city/state/zipCode
  const street = safeString(contact?.address?.street);
  const city = safeString(contact?.address?.city);
  const state = safeString(contact?.address?.state);
  const zip = safeString(contact?.address?.zipCode);
  return [street, city, `${state} ${zip}`.trim()].filter(Boolean).join(", ");
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

function determinePrimaryJobType(recipientType: "sender" | "receiver"): JobType {
  return recipientType === "sender" ? "pickup" : "delivery";
}

const serve_handler = async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      orderId,
      recipientType,
      deliveryTime,
      customMessage,
      relatedJobs,
    }: TimeslotRequest = await req.json();

    console.log(
      `Processing timeslot request for order ${orderId}, primary recipientType=${recipientType}, time=${deliveryTime}`,
    );

    if (relatedJobs?.length) {
      console.log(`Related jobs received: ${relatedJobs.length}`);
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Fetch primary order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order not found:", orderError);
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Contact + scheduled date for PRIMARY message (still based on recipientType)
    const contact = recipientType === "sender" ? order.sender : order.receiver;
    const scheduledDateForMessage =
      recipientType === "sender"
        ? order.scheduled_pickup_date
        : order.scheduled_delivery_date;

    if (!contact || !contact.phone) {
      console.error(`No phone number found for ${recipientType}`);
      return new Response(
        JSON.stringify({ error: `No phone number found for ${recipientType}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!scheduledDateForMessage) {
      console.error(`No scheduled date found for ${recipientType}`);
      return new Response(
        JSON.stringify({
          error: `No scheduled date found for ${recipientType}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Customer-facing time window for WhatsApp/email message (start -> +3h, clamped at 23 for display)
    const [deliveryHour, deliveryMinute] = deliveryTime.split(":").map(Number);
    const startTimeDisplay = `${String(deliveryHour).padStart(2, "0")}:${String(deliveryMinute).padStart(2, "0")}`;
    const endHourDisplay = Math.min(23, deliveryHour + 3);
    const endTimeDisplay = `${String(endHourDisplay).padStart(2, "0")}:${String(deliveryMinute).padStart(2, "0")}`;

    // Build WhatsApp/email message text
    let message: string;
    if (customMessage) {
      message = customMessage;
    } else if (recipientType === "sender") {
      message = `Dear ${contact.name},

Your ${order.bike_brand || "bike"} ${order.bike_model || ""} Collection has been scheduled for ${formatDateForCustomer(scheduledDateForMessage)} between ${startTimeDisplay} and ${endTimeDisplay}.

You will receive a text with a live tracking link once the driver is on his way.

Please ensure the pedals have been removed from the bike and in a bag along with any other accessories. Make sure the bag is attached to the bike securely to avoid any loss.

Thank you!
Cycle Courier Co.`;
    } else {
      message = `Dear ${contact.name},

Your ${order.bike_brand || "bike"} ${order.bike_model || ""} Delivery has been scheduled for ${formatDateForCustomer(scheduledDateForMessage)} between ${startTimeDisplay} and ${endTimeDisplay}.

You will receive a text with a live tracking link once the driver is on his way.

Thank you!
Cycle Courier Co.`;
    }

    // Initialize Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    // -----------------------------
    // OPERATION 1: WhatsApp via 2chat
    // -----------------------------
    let whatsappResult: any = { success: false };
    try {
      console.log("--- Starting WhatsApp operation ---");

      const twoChatApiKey = Deno.env.get("TWOCHAT_API_KEY");
      const fromNumber = Deno.env.get("TWOCHAT_FROM_NUMBER");

      if (!twoChatApiKey || !fromNumber) {
        throw new Error("2Chat API credentials not configured");
      }

      const cleanPhone = normalizePhone(contact.phone);

      const whatsappResponse = await fetch(
        "https://api.p.2chat.io/open/whatsapp/send-message",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-API-Key": twoChatApiKey,
          },
          body: JSON.stringify({
            to_number: `+${cleanPhone}`,
            from_number: fromNumber,
            text: message,
          }),
        },
      );

      const contentType = whatsappResponse.headers.get("content-type");

      if (contentType?.includes("application/json")) {
        const jsonData = await whatsappResponse.json();
        whatsappResult = { success: whatsappResponse.ok, data: jsonData };
        console.log("WhatsApp API response:", jsonData);
      } else {
        const errorText = await whatsappResponse.text();
        whatsappResult = {
          success: false,
          error: "WhatsApp API returned non-JSON response",
          details: errorText.substring(0, 200),
        };
        console.error("WhatsApp non-JSON response:", errorText.substring(0, 500));
      }
    } catch (whatsappError: any) {
      whatsappResult = {
        success: false,
        error: whatsappError?.message || "Failed to send WhatsApp message",
      };
      console.error("WhatsApp operation error:", whatsappError);
    }
    console.log("WhatsApp operation result:", whatsappResult.success ? "SUCCESS" : "FAILED");

    // -----------------------------
    // OPERATION 2: Update Shipday (Option A: explicit jobType per related)
    // -----------------------------
    let shipdayResult: any = { success: false, orders: [] };
    try {
      console.log("--- Starting Shipday operation ---");

      const shipdayApiKey = Deno.env.get("SHIPDAY_API_KEY");
      if (!shipdayApiKey) throw new Error("Shipday API key not configured");

      // Build the list of (order, jobType) to update:
      const primaryJobType = determinePrimaryJobType(recipientType);

      const jobsToUpdate: Array<{ orderRecord: any; jobType: JobType; isPrimary: boolean }> = [
        { orderRecord: order, jobType: primaryJobType, isPrimary: true },
      ];

      // Fetch and attach related orders with their explicit job types
      if (relatedJobs?.length) {
        for (const r of relatedJobs) {
          const { data: relatedOrder, error: relatedError } = await supabase
            .from("orders")
            .select("*")
            .eq("id", r.orderId)
            .single();

          if (relatedError || !relatedOrder) {
            console.error(`Failed to fetch related order ${r.orderId}:`, relatedError);
            continue;
          }

          jobsToUpdate.push({
            orderRecord: relatedOrder,
            jobType: r.jobType,
            isPrimary: false,
          });
        }
      }

      console.log(`Updating Shipday for ${jobsToUpdate.length} job(s)...`);

      const shipdayResults: any[] = [];

      // Calculate timeslot start/end safely (handles midnight rollover)
      const start = addMinutesToHHMM(deliveryTime, 0);
      const end = addMinutesToHHMM(deliveryTime, 180);

      for (const item of jobsToUpdate) {
        const orderToUpdate = item.orderRecord;
        const jobType: JobType = item.jobType;

        const isPickup = jobType === "pickup";

        const shipdayId = isPickup
          ? orderToUpdate.shipday_pickup_id
          : orderToUpdate.shipday_delivery_id;

        if (!shipdayId) {
          shipdayResults.push({
            orderId: orderToUpdate.id,
            jobType,
            status: "no_shipday_id",
          });
          continue;
        }

        const scheduledRaw = isPickup
          ? orderToUpdate.scheduled_pickup_date
          : orderToUpdate.scheduled_delivery_date;

        if (!scheduledRaw) {
          shipdayResults.push({
            orderId: orderToUpdate.id,
            jobType,
            status: "no_scheduled_date",
          });
          continue;
        }

        const scheduledUTCDate = toUTCYYYYMMDD(scheduledRaw);
        const expectedPickupTime = start.hhmmss;
        const expectedDeliveryTime = end.hhmmss;

        // If end time rolls into next day, roll expectedDeliveryDate
        const expectedDeliveryDate =
          end.dayOffset === 0
            ? scheduledUTCDate
            : addDaysToUTCYYYYMMDD(scheduledUTCDate, end.dayOffset);

        const jobContact = isPickup ? orderToUpdate.sender : orderToUpdate.receiver;
        const jobNotes = isPickup ? orderToUpdate.sender_notes : orderToUpdate.receiver_notes;

        // Build delivery instructions
        const bikeInfo =
          orderToUpdate.bike_brand && orderToUpdate.bike_model
            ? `Bike: ${orderToUpdate.bike_brand} ${orderToUpdate.bike_model}`
            : orderToUpdate.bike_brand
              ? `Bike: ${orderToUpdate.bike_brand}`
              : orderToUpdate.bike_model
                ? `Bike: ${orderToUpdate.bike_model}`
                : "";

        const orderDetails: string[] = [];
        if (bikeInfo) orderDetails.push(bikeInfo);
        if (orderToUpdate.customer_order_number)
          orderDetails.push(`Order #: ${orderToUpdate.customer_order_number}`);
        if (orderToUpdate.collection_code)
          orderDetails.push(`eBay Code: ${orderToUpdate.collection_code}`);
        if (orderToUpdate.needs_payment_on_collection)
          orderDetails.push("Payment required on collection");
        if (orderToUpdate.is_ebay_order) orderDetails.push("eBay Order");
        if (orderToUpdate.is_bike_swap) orderDetails.push("Bike Swap");

        const baseDeliveryInstructions = orderToUpdate.delivery_instructions || "";
        const allInstructions = [
          ...orderDetails,
          baseDeliveryInstructions,
          jobNotes,
        ]
          .filter(Boolean)
          .join(" | ");

        const requestBody = {
          orderNumber:
            orderToUpdate.tracking_number ||
            `${orderToUpdate.id.substring(0, 8)}-UPDATE`,
          customerName: jobContact?.name,
          customerAddress: normalizeAddress(jobContact),
          customerEmail: jobContact?.email,
          customerPhoneNumber: jobContact?.phone,
          restaurantName: "Cycle Courier Co.",
          restaurantAddress: "Lawden road, birmingham, b100ad, united kingdom",
          expectedPickupTime,
          expectedDeliveryTime,
          expectedDeliveryDate,
          deliveryInstruction: allInstructions,
        };

        console.log("Shipday update payload:", {
          orderId: orderToUpdate.id,
          jobType,
          shipdayId,
          scheduledRaw,
          scheduledUTCDate,
          expectedPickupTime,
          expectedDeliveryTime,
          expectedDeliveryDate,
        });

        try {
          const shipdayUrl = `https://api.shipday.com/order/edit/${shipdayId}`;

          const shipdayResponse = await fetch(shipdayUrl, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${shipdayApiKey}`,
            },
            body: JSON.stringify(requestBody),
          });

          if (shipdayResponse.ok) {
            shipdayResults.push({
              orderId: orderToUpdate.id,
              jobType,
              shipdayId,
              status: "success",
            });
          } else {
            const responseText = await shipdayResponse.text();
            shipdayResults.push({
              orderId: orderToUpdate.id,
              jobType,
              shipdayId,
              status: "failed",
              error: responseText,
            });
          }
        } catch (e: any) {
          shipdayResults.push({
            orderId: orderToUpdate.id,
            jobType,
            shipdayId,
            status: "error",
            error: e?.message || "Unknown error",
          });
        }
      }

      shipdayResult = {
        success: shipdayResults.some((r) => r.status === "success"),
        orders: shipdayResults,
        allSuccessful: shipdayResults.length > 0 && shipdayResults.every((r) => r.status === "success"),
      };

      console.log("Shipday operation results:", shipdayResults);
    } catch (shipdayError: any) {
      shipdayResult = {
        success: false,
        error: shipdayError?.message || "Failed to update Shipday",
      };
      console.error("Shipday operation error:", shipdayError);
    }
    console.log("Shipday operation result:", shipdayResult.success ? "SUCCESS" : "FAILED");

    // -----------------------------
    // OPERATION 3: Send Email via Resend
    // -----------------------------
    let emailResult: any = { success: false };
    try {
      console.log("--- Starting Email operation ---");

      if (!resend) throw new Error("Email service not configured");
      if (!contact.email) throw new Error("No email address found for recipient");

      const emailSubject = customMessage
        ? "Your Bike Deliveries and Collections have been Scheduled"
        : recipientType === "sender"
          ? `Your ${order.bike_brand || "bike"} collection has been scheduled - ${order.tracking_number}`
          : `Your ${order.bike_brand || "bike"} delivery has been scheduled - ${order.tracking_number}`;

      let emailHtml: string;

      if (customMessage) {
        // For grouped messages, format the custom message with basic styling
        const lines = customMessage.split("\n\n");
        let emailContent = "";
        const hasCollections = customMessage.includes("Collections:");

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;

          if (line.startsWith("Dear ")) {
            emailContent += `<h2>${line}</h2>\n`;
          } else if (line.includes("We are due to be with you")) {
            emailContent += `<p>${line}</p>\n`;
          } else if (line.includes("Deliveries:") || line.includes("Collections:")) {
            emailContent += `<p><strong>${line}</strong></p>\n`;
          } else if (line.includes("You will receive a text")) {
            emailContent += `<p>${line}</p>\n`;

            if (hasCollections) {
              emailContent += `
                <div style="border-left: 4px solid #ffa500; padding-left: 16px; margin: 20px 0; background-color: #fff8f0; padding: 16px; border-radius: 4px;">
                  <p style="margin: 0 0 10px 0; font-weight: bold; color: #e67e22;">📦 Collection Instructions</p>
                  <ul style="margin: 0; padding-left: 20px; color: #2c3e50;">
                    <li style="margin-bottom: 8px;">Please ensure the pedals have been removed from the bikes we are collecting and placed in a secure bag</li>
                    <li style="margin-bottom: 8px;">Any other accessories should also be placed in the bag</li>
                    <li style="margin-bottom: 0;">Make sure the bag is securely attached to the bike to avoid any loss</li>
                  </ul>
                </div>
              `;
            }
          } else if (line.includes("Please ensure the pedals")) {
            continue; // replaced by formatted box
          } else if (line === "Thank you!") {
            emailContent += `<p style="margin-top: 30px; font-weight: bold;">${line}</p>\n`;
          } else if (line === "Cycle Courier Co.") {
            emailContent += `<p style="margin-top: 10px;"><strong>${line}</strong></p>\n`;
          } else {
            emailContent += `<p>${line}</p>\n`;
          }
        }

        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
            ${emailContent}
          </div>
        `;
      } else {
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Dear ${contact.name},</h2>

            <p>Your <strong>${order.bike_brand || "bike"} ${order.bike_model || ""}</strong> ${
              recipientType === "sender" ? "Collection" : "Delivery"
            } has been scheduled for:</p>

            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 18px;"><strong>${formatDateForCustomer(scheduledDateForMessage)}</strong></p>
              <p style="margin: 5px 0; font-size: 16px;">Between <strong>${startTimeDisplay}</strong> and <strong>${endTimeDisplay}</strong></p>
            </div>

            <p>You will receive a text with a live tracking link once the driver is on their way.</p>

            ${
              recipientType === "sender"
                ? `
              <div style="border-left: 4px solid #ffa500; padding-left: 16px; margin: 20px 0; background-color: #fff8f0; padding: 16px; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #e67e22;">📦 Collection Instructions</p>
                <ul style="margin: 0; padding-left: 20px; color: #2c3e50;">
                  <li style="margin-bottom: 8px;">Please ensure the pedals have been removed from the bike and placed in a secure bag</li>
                  <li style="margin-bottom: 8px;">Any other accessories should also be placed in the bag</li>
                  <li style="margin-bottom: 0;">Make sure the bag is securely attached to the bike to avoid any loss</li>
                </ul>
              </div>
            `
                : ""
            }

            <p style="margin-top: 30px;">Thank you!</p>
            <p><strong>Cycle Courier Co.</strong></p>
          </div>
        `;
      }

      const emailData = await resend.emails.send({
        from: "Ccc@notification.cyclecourierco.com",
        to: [contact.email],
        subject: emailSubject,
        html: emailHtml,
      });

      emailResult = { success: true, data: emailData };
      console.log("Email sent successfully:", emailData);
    } catch (emailError: any) {
      emailResult = { success: false, error: emailError?.message || "Failed to send email" };
      console.error("Email operation error:", emailError);
    }
    console.log("Email operation result:", emailResult.success ? "SUCCESS" : "FAILED");

    // Overall response
    const overallSuccess =
      whatsappResult.success || shipdayResult.success || emailResult.success;

    return new Response(
      JSON.stringify({
        success: overallSuccess,
        results: {
          whatsapp: whatsappResult,
          shipday: shipdayResult,
          email: emailResult,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Unexpected error in send-timeslot-whatsapp function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Unexpected error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
};

serve(serve_handler);
