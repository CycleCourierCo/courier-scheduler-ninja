import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JobType = "pickup" | "delivery";

interface RelatedJob {
  orderId: string;
  jobType: JobType;
}

interface SendZenRequest {
  orderId: string;
  type: "collection_timeslots" | "delivery_timeslot" | "grouped_timeslot" | "review";
  recipientType: "sender" | "receiver";
  deliveryTime?: string; // "HH:MM"
  collectionJobList?: string;
  deliveryJobList?: string;
  relatedJobs?: RelatedJob[];
}

function formatDateForTemplate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const localDate = new Date(year, month, day);
  return localDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function calculateEndTime(startTime: string): string {
  const [h, m] = startTime.split(":").map(Number);
  const endHour = Math.min(23, h + 3);
  return `${String(endHour).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `+${digits}`;
}

function safeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function normalizeAddress(contact: any): string {
  const street = safeString(contact?.address?.street);
  const city = safeString(contact?.address?.city);
  const state = safeString(contact?.address?.state);
  const zip = safeString(contact?.address?.zipCode);
  return [street, city, `${state} ${zip}`.trim()].filter(Boolean).join(", ");
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
  const dayOffset = Math.floor(total / (24 * 60));
  const minsInDay = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(minsInDay / 60)).padStart(2, "0");
  const mm = String(minsInDay % 60).padStart(2, "0");
  return { hhmmss: `${hh}:${mm}:00`, dayOffset };
}

function toUTCYYYYMMDD(dateStr: string): string {
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) throw new Error(`Invalid date: ${dateStr}`);
  return dt.toISOString().slice(0, 10);
}

function addDaysToUTCYYYYMMDD(yyyyMmDd: string, days: number) {
  const [y, mo, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function determinePrimaryJobType(recipientType: "sender" | "receiver"): JobType {
  return recipientType === "sender" ? "pickup" : "delivery";
}

// ---- Background: Update Shipday (exact copy of send-timeslot-whatsapp logic) ----
async function updateShipday(
  order: any,
  recipientType: "sender" | "receiver",
  deliveryTime: string,
  relatedJobs: RelatedJob[] | undefined,
  supabase: any,
) {
  console.log("--- Starting Shipday operation ---");

  const shipdayApiKey = Deno.env.get("SHIPDAY_API_KEY");
  if (!shipdayApiKey) { console.error("Shipday API key not configured"); return; }

  const primaryJobType = determinePrimaryJobType(recipientType);
  const jobsToUpdate: Array<{ orderRecord: any; jobType: JobType; isPrimary: boolean }> = [
    { orderRecord: order, jobType: primaryJobType, isPrimary: true },
  ];

  if (relatedJobs?.length) {
    for (const r of relatedJobs) {
      const { data: relatedOrder, error: relatedError } = await supabase
        .from("orders").select("*").eq("id", r.orderId).single();

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
      console.log(`Skipping order ${orderToUpdate.id} (${jobType}): no shipday_${jobType === "pickup" ? "pickup" : "delivery"}_id`);
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
      console.log(`Skipping order ${orderToUpdate.id} (${jobType}): no scheduled_${jobType === "pickup" ? "pickup" : "delivery"}_date`);
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

  console.log("Shipday operation results:", shipdayResults);
  console.log("Shipday operation result:", shipdayResults.some((r) => r.status === "success") ? "SUCCESS" : "FAILED");
}

// ---- Background: Send Email via Resend ----
async function sendEmail(
  order: any,
  contact: any,
  recipientType: "sender" | "receiver",
  type: string,
  deliveryTime: string | undefined,
  scheduledDate: string | undefined,
  collectionJobList: string | undefined,
  deliveryJobList: string | undefined,
) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) { console.error("Resend API key not configured"); return; }
  if (!contact?.email) { console.log("No email for recipient, skipping"); return; }

  const resend = new Resend(resendApiKey);

  if (type === "review") {
    // No email for review messages
    return;
  }

  if (!deliveryTime || !scheduledDate) { console.log("Missing time/date for email"); return; }

  const formattedDate = formatDateForTemplate(scheduledDate);
  const startTime = deliveryTime;
  const endTime = calculateEndTime(deliveryTime);

  let emailSubject: string;
  let emailHtml: string;

  if (type === "grouped_timeslot") {
    emailSubject = "Your Bike Deliveries and Collections have been Scheduled";

    const hasCollections = !!(collectionJobList && collectionJobList.trim());
    const hasDeliveries = !!(deliveryJobList && deliveryJobList.trim());

    let itemsHtml = "";
    if (hasCollections) {
      itemsHtml += `<p><strong>Collections: ${collectionJobList}</strong></p>\n`;
    }
    if (hasDeliveries) {
      itemsHtml += `<p><strong>Deliveries: ${deliveryJobList}</strong></p>\n`;
    }

    const collectionInstructions = hasCollections ? `
      <div style="border-left: 4px solid #ffa500; padding-left: 16px; margin: 20px 0; background-color: #fff8f0; padding: 16px; border-radius: 4px;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #e67e22;">📦 Collection Instructions</p>
        <ul style="margin: 0; padding-left: 20px; color: #2c3e50;">
          <li style="margin-bottom: 8px;">Please ensure the pedals have been removed from the bikes we are collecting and placed in a secure bag</li>
          <li style="margin-bottom: 8px;">Any other accessories should also be placed in the bag</li>
          <li style="margin-bottom: 0;">Make sure the bag is securely attached to the bike to avoid any loss</li>
        </ul>
      </div>
    ` : "";

    emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
        <h2>Dear ${contact.name || "Customer"},</h2>
        <p>We are due to be with you on <strong>${formattedDate}</strong> between <strong>${startTime}</strong> and <strong>${endTime}</strong>.</p>
        ${itemsHtml}
        <p>You will receive a text with a live tracking link once the driver is on his way.</p>
        ${collectionInstructions}
        <p style="margin-top: 30px; font-weight: bold;">Thank you!</p>
        <p><strong>Cycle Courier Co.</strong></p>
      </div>
    `;
  } else {
    // Individual timeslot (collection_timeslots or delivery_timeslot)
    const isCollection = type === "collection_timeslots";
    const bikeBrand = order.bike_brand || "bike";
    const bikeModel = order.bike_model || "";

    emailSubject = `Your ${bikeBrand} ${isCollection ? "collection" : "delivery"} has been scheduled - ${order.tracking_number || ""}`;

    emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
        <h2>Dear ${contact.name || "Customer"},</h2>
        <p>Your <strong>${bikeBrand} ${bikeModel}</strong> ${isCollection ? "Collection" : "Delivery"} has been scheduled for:</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 18px;"><strong>${formattedDate}</strong></p>
          <p style="margin: 5px 0; font-size: 16px;">Between <strong>${startTime}</strong> and <strong>${endTime}</strong></p>
        </div>
        <p>You will receive a text with a live tracking link once the driver is on their way.</p>
        ${isCollection ? `
          <div style="border-left: 4px solid #ffa500; padding-left: 16px; margin: 20px 0; background-color: #fff8f0; padding: 16px; border-radius: 4px;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #e67e22;">📦 Collection Instructions</p>
            <ul style="margin: 0; padding-left: 20px; color: #2c3e50;">
              <li style="margin-bottom: 8px;">Please ensure the pedals have been removed from the bike and placed in a secure bag</li>
              <li style="margin-bottom: 8px;">Any other accessories should also be placed in the bag</li>
              <li style="margin-bottom: 0;">Make sure the bag is securely attached to the bike to avoid any loss</li>
            </ul>
          </div>
        ` : ""}
        <p style="margin-top: 30px;">Thank you!</p>
        <p><strong>Cycle Courier Co.</strong></p>
      </div>
    `;
  }

  try {
    const emailData = await resend.emails.send({
      from: "Ccc@notification.cyclecourierco.com",
      to: [contact.email],
      subject: emailSubject,
      html: emailHtml,
    });
    console.log("Email sent successfully:", JSON.stringify(emailData));
  } catch (e: any) {
    console.error("Email send error:", e?.message);
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      orderId,
      type,
      recipientType,
      deliveryTime,
      collectionJobList,
      deliveryJobList,
      relatedJobs,
    }: SendZenRequest = await req.json();

    console.log(`SendZen request: type=${type}, orderId=${orderId}, recipientType=${recipientType}`);

    const sendzenApiKey = Deno.env.get("SENDZEN_API_KEY");
    if (!sendzenApiKey) {
      return new Response(
        JSON.stringify({ error: "SendZen API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Fetch the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order not found:", orderError);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get contact based on recipientType
    const contact = recipientType === "sender" ? order.sender : order.receiver;
    if (!contact?.phone) {
      return new Response(
        JSON.stringify({ error: `No phone number found for ${recipientType}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phone = normalizePhone(contact.phone);
    const fromNumber = "441217980767";

    // Scheduled date for email/Shipday
    const scheduledDate = recipientType === "sender"
      ? order.scheduled_pickup_date
      : order.scheduled_delivery_date;

    // Build the SendZen API request based on template type
    let sendzenBody: any;

    if (type === "collection_timeslots" || type === "delivery_timeslot") {
      if (!scheduledDate || !deliveryTime) {
        return new Response(
          JSON.stringify({ error: "Missing scheduled date or delivery time" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const formattedDate = formatDateForTemplate(scheduledDate);
      const startTime = deliveryTime;
      const endTime = calculateEndTime(deliveryTime);
      const bikeBrand = order.bike_brand || "bike";
      const bikeModel = order.bike_model || "";
      const trackingUrl = order.tracking_number
        ? `https://cyclecourierco.com/tracking/${order.tracking_number}`
        : "https://cyclecourierco.com";

      sendzenBody = {
        to: phone,
        from: fromNumber,
        type: "template",
        template: {
          name: type,
          lang_code: "en_GB",
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: contact.name || "Customer", parameter_name: "contact_name" },
                { type: "text", text: bikeBrand, parameter_name: "bike_brand" },
                { type: "text", text: bikeModel, parameter_name: "bike_model" },
                { type: "text", text: formattedDate, parameter_name: "date" },
                { type: "text", text: startTime, parameter_name: "start_time" },
                { type: "text", text: endTime, parameter_name: "end_time" },
              ],
            },
            {
              type: "button",
              sub_type: "url",
              index: 0,
              parameters: [
                { type: "text", text: trackingUrl, parameter_name: "tracking_url" },
              ],
            },
          ],
        },
      };
    } else if (type === "grouped_timeslot") {
      if (!scheduledDate || !deliveryTime) {
        return new Response(
          JSON.stringify({ error: "Missing scheduled date or delivery time" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const formattedDate = formatDateForTemplate(scheduledDate);
      const startTime = deliveryTime;
      const endTime = calculateEndTime(deliveryTime);

      sendzenBody = {
        to: phone,
        from: fromNumber,
        type: "template",
        template: {
          name: "grouped_timeslot",
          lang_code: "en_GB",
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: contact.name || "Customer", parameter_name: "contact_name" },
                { type: "text", text: formattedDate, parameter_name: "date" },
                { type: "text", text: startTime, parameter_name: "start_time" },
                { type: "text", text: endTime, parameter_name: "end_time" },
                { type: "text", text: collectionJobList || "", parameter_name: "collection_job_list" },
                { type: "text", text: deliveryJobList || "", parameter_name: "delivery_job_list" },
              ],
            },
          ],
        },
      };
    } else if (type === "review") {
      sendzenBody = {
        to: phone,
        from: fromNumber,
        type: "template",
        template: {
          name: "review",
          lang_code: "en_GB",
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: contact.name || "Customer", parameter_name: "customer_name" },
              ],
            },
          ],
        },
      };
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown template type: ${type}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Sending SendZen request:", JSON.stringify({ template: type, to: phone }));

    // Run all three operations in the background and return immediately
    EdgeRuntime.waitUntil(
      Promise.allSettled([
        // 1. SendZen WhatsApp
        fetch("https://api.sendzen.io/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${sendzenApiKey}`,
          },
          body: JSON.stringify(sendzenBody),
        }).then(async (res) => {
          const text = await res.text();
          console.log("SendZen send complete:", res.status, text);
        }).catch((err) => {
          console.error("SendZen send failed:", err);
        }),

        // 2. Shipday update (skip for review)
        type !== "review" && deliveryTime
          ? updateShipday(order, recipientType, deliveryTime, relatedJobs, supabase)
          : Promise.resolve(),

        // 3. Email via Resend (skip for review)
        type !== "review"
          ? sendEmail(order, contact, recipientType, type, deliveryTime, scheduledDate, collectionJobList, deliveryJobList)
          : Promise.resolve(),
      ]).then((results) => {
        console.log("All background operations complete:", results.map(r => r.status));
      })
    );

    return new Response(
      JSON.stringify({ success: true, data: { status: "queued" } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("SendZen edge function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
