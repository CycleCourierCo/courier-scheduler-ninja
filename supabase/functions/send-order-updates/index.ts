import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { expectationsHtml, expectationsText, expectationsForOrder } from "../_shared/deliveryExpectations.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BASE_URL = "https://booking.cyclecourierco.com";

/** Minimum gap between proactive updates to the same side of the same job. */
const QUIET_DAYS = 2;

type Side = "sender" | "receiver";

interface Update {
  side: Side;
  stageKey: string;
  subject: string;
  headline: string;
  lines: string[];
}

const londonDay = (value?: string | Date | null): string | null => {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
};

const todayLondon = () => londonDay(new Date())!;

const prettyDate = (value?: string | null): string => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
};

const itemName = (order: any): string => {
  const bikes = Array.isArray(order.bikes) ? order.bikes : [];
  if (bikes.length > 1) return `${bikes.length} bicycles`;
  const first = bikes[0] || {};
  const name = `${first.brand || order.bike_brand || ""} ${first.model || order.bike_model || ""}`.trim();
  return name || "your bicycle";
};

const hasDates = (value: any): boolean => {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
};

/**
 * Work out which single update (if any) each side should receive right now,
 * based on where the job actually is.
 */
function deriveUpdates(order: any, inspectionPending = false): Update[] {
  const updates: Update[] = [];
  const item = itemName(order);
  const status: string = order.status || "";
  const today = todayLondon();

  const push = (u: Update) => updates.push(u);

  // ---- Box My Bike ---------------------------------------------------------
  if (order.is_box_my_bike) {
    const boxStage: Record<string, { key: string; head: string; lines: string[] }> = {
      awaiting_depot: {
        key: "box_awaiting_depot",
        head: "Your bike is on its way to our depot",
        lines: ["We're bringing your bike into our depot ready for boxing."],
      },
      in_depot_awaiting_boxing: {
        key: "box_in_depot",
        head: "Your bike is safely at our depot",
        lines: ["It's now in the queue to be professionally boxed."],
      },
      boxed_awaiting_label: {
        key: "box_boxed",
        head: "Your bike is boxed",
        lines: ["It's boxed and we're waiting on the shipping label before hand-off."],
      },
      awaiting_3p_collection: {
        key: "box_awaiting_3p",
        head: "Your bike is ready for courier collection",
        lines: ["It's boxed, labelled and waiting for the courier to collect."],
      },
      collected_by_3p: {
        key: "box_collected_3p",
        head: "Your bike has been collected by the courier",
        lines: ["It's now with the onward courier and tracking is with them."],
      },
    };
    const stage = boxStage[order.box_my_bike_status || ""] || boxStage[status];
    if (stage) {
      for (const side of ["sender", "receiver"] as Side[]) {
        push({
          side,
          stageKey: stage.key,
          subject: `Update on ${item}`,
          headline: stage.head,
          lines: stage.lines,
        });
      }
    }
    return updates;
  }

  // ---- Foam My Bike / Northern Ireland ------------------------------------
  if (order.is_northern_ireland || order.foam_status) {
    const foamStage: Record<string, { key: string; head: string; lines: string[] }> = {
      pending_collection: {
        key: "foam_pending_collection",
        head: "We're arranging your collection",
        lines: ["Your bike is booked in for collection ahead of its journey to Northern Ireland."],
      },
      pending_foaming: {
        key: "foam_pending_foaming",
        head: "Your bike is at our depot",
        lines: ["It's in the queue to be foam-protected for the ferry crossing."],
      },
      foamed_ready: {
        key: "foam_ready",
        head: "Your bike is protected and ready",
        lines: ["It's foam-protected and ready for its journey to the ferry port."],
      },
      delivered_to_ferry: {
        key: "foam_at_ferry",
        head: "Your bike has reached the ferry port",
        lines: [
          "It's awaiting transport to Northern Ireland. Your final delivery date will be confirmed once it has arrived.",
        ],
      },
    };
    const stage = foamStage[order.foam_status || ""];
    if (stage) {
      for (const side of ["sender", "receiver"] as Side[]) {
        push({
          side,
          stageKey: stage.key,
          subject: `Update on ${item}`,
          headline: stage.head,
          lines: stage.lines,
        });
      }
      return updates;
    }
  }

  // ---- Delays -------------------------------------------------------------
  const pickupDay = londonDay(order.scheduled_pickup_date);
  const deliveryDay = londonDay(order.scheduled_delivery_date);

  if (pickupDay && pickupDay < today && !order.order_collected) {
    push({
      side: "sender",
      stageKey: "collection_delayed",
      subject: `Sorry - we missed your collection for ${item}`,
      headline: "We're sorry your collection hasn't happened yet",
      lines: [
        `Your collection was planned for ${prettyDate(order.scheduled_pickup_date)} and unfortunately it didn't go ahead.`,
        "Our team is rebooking it now and will send you a new time slot as soon as it's set. You don't need to do anything.",
      ],
    });
    return updates;
  }

  if (deliveryDay && deliveryDay < today && order.order_collected && !order.order_delivered) {
    push({
      side: "receiver",
      stageKey: "delivery_delayed",
      subject: `Sorry - we missed your delivery for ${item}`,
      headline: "We're sorry your delivery hasn't happened yet",
      lines: [
        `Your delivery was planned for ${prettyDate(order.scheduled_delivery_date)} and unfortunately it didn't go ahead.`,
        "Your bike is safe with us and we're rebooking now. You'll get a new time slot shortly.",
      ],
    });
    return updates;
  }

  // ---- Awaiting availability ---------------------------------------------
  if (!order.sender_confirmed_at && !hasDates(order.pickup_date)) {
    push({
      side: "sender",
      stageKey: status === "created" ? "booked_awaiting_request" : "awaiting_sender_dates",
      subject: `We need your collection dates for ${item}`,
      headline: "We're waiting on your collection availability",
      lines: [
        "We've got your booking safely in our system. To get moving we just need the dates you're available for collection.",
        `You can set them here: <a href="${BASE_URL}/sender-availability/${order.id}">choose your collection dates</a>.`,
      ],
    });
  }

  // Never chase the receiver for delivery dates while the bike is still in
  // inspection / repair — that handoff is deferred until the workshop finishes.
  if (
    order.sender_confirmed_at &&
    !order.receiver_confirmed_at &&
    !hasDates(order.delivery_date) &&
    !order.order_delivered &&
    !inspectionPending
  ) {
    push({
      side: "receiver",
      stageKey: "awaiting_receiver_dates",
      subject: `We need your delivery dates for ${item}`,
      headline: "We're waiting on your delivery availability",
      lines: [
        "We're getting ready to bring your bike to you and just need the dates you're available.",
        `You can set them here: <a href="${BASE_URL}/receiver-availability/${order.id}">choose your delivery dates</a>.`,
      ],
    });
  }

  // ---- Dates in, awaiting a route ----------------------------------------
  if (order.sender_confirmed_at && !order.scheduled_pickup_date && !order.order_collected) {
    push({
      side: "sender",
      stageKey: "sender_dates_received",
      subject: `We're planning your collection for ${item}`,
      headline: "Thanks for your dates - we're building your route",
      lines: [
        "We're fitting your collection into a route that works with the dates you gave us.",
        "You'll get a time slot the day before we're due with you.",
      ],
    });
  }

  // ---- Collection scheduled ----------------------------------------------
  if (order.scheduled_pickup_date && !order.order_collected && pickupDay && pickupDay >= today) {
    const when = prettyDate(order.scheduled_pickup_date);
    push({
      side: "sender",
      stageKey: "collection_scheduled",
      subject: `Your collection is booked for ${item}`,
      headline: `Your collection is booked for ${when}`,
      lines: ["We'll send your time slot the day before so you know when to expect us."],
    });
    push({
      side: "receiver",
      stageKey: "collection_scheduled_receiver",
      subject: `Collection booked for ${item}`,
      headline: `The bike coming to you is booked for collection on ${when}`,
      lines: [
        "Once it's collected we'll arrange your delivery around the dates you've given us.",
      ],
    });
  }

  // ---- With us: depot / inspection / repair ------------------------------
  const withUs =
    order.order_collected &&
    !order.order_delivered &&
    !order.scheduled_delivery_date;

  if (withUs) {
    const inspectionLine = order.needs_inspection
      ? "Our workshop is working through its inspection and any agreed work before it moves on."
      : "It's with us at our depot and being prepared for onward delivery.";
    for (const side of ["sender", "receiver"] as Side[]) {
      push({
        side,
        stageKey: "in_depot",
        subject: `${item} is safely with us`,
        headline: "Your bike is safely at our depot",
        lines: [
          inspectionLine,
          order.receiver_confirmed_at
            ? "We're arranging the delivery around the dates already given to us."
            : "We'll be in touch to arrange delivery dates shortly.",
        ],
      });
    }
  }

  // ---- Delivery scheduled -------------------------------------------------
  if (order.scheduled_delivery_date && !order.order_delivered && deliveryDay && deliveryDay >= today && !order.is_northern_ireland) {
    push({
      side: "receiver",
      stageKey: "delivery_scheduled",
      subject: `Your delivery is booked for ${item}`,
      headline: `Your delivery is booked for ${prettyDate(order.scheduled_delivery_date)}`,
      lines: ["We'll send your time slot the day before so you know when to expect us."],
    });
  }

  return updates;
}

function buildHtml(order: any, update: Update, name: string): string {
  const trackingUrl = order.tracking_number ? `${BASE_URL}/tracking/${order.tracking_number}` : "";
  const body = update.lines.map((l) => `<p style="line-height:1.6;">${l}</p>`).join("");
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#1f2937;">
      <h2>Hello ${name},</h2>
      <p>Here's an update on your booking with The Cycle Courier Co. - no action needed unless we've asked for something below.</p>
      <div style="background-color:#f7f7f7;padding:16px;border-radius:5px;margin:20px 0;">
        <p style="margin:0 0 8px;"><strong>${update.headline}</strong></p>
        <p style="margin:0;"><strong>Item:</strong> ${itemName(order)}</p>
        ${order.tracking_number ? `<p style="margin:8px 0 0;"><strong>Tracking Number:</strong> ${order.tracking_number}</p>` : ""}
      </div>
      ${body}
      ${expectationsHtml(expectationsForOrder(order))}
      ${trackingUrl ? `<div style="text-align:center;margin:24px 0;"><a href="${trackingUrl}" style="background-color:#4a65d5;color:#ffffff;padding:12px 20px;text-decoration:none;border-radius:5px;font-weight:bold;">Track Your Bike</a></div>` : ""}
      <p>If anything has changed or you have a question, just reply to this email.</p>
      <p>Thank you,<br>The Cycle Courier Co. Team</p>
    </div>
  `;
}

function buildText(order: any, update: Update, name: string): string {
  const trackingUrl = order.tracking_number ? `${BASE_URL}/tracking/${order.tracking_number}` : "";
  const strip = (s: string) => s.replace(/<[^>]+>/g, "");
  return [
    `Hello ${name},`,
    "",
    "Here's an update on your booking with The Cycle Courier Co.",
    "",
    update.headline,
    `Item: ${itemName(order)}`,
    order.tracking_number ? `Tracking Number: ${order.tracking_number}` : "",
    "",
    ...update.lines.map(strip),
    "",
    expectationsText(expectationsForOrder(order)),
    trackingUrl ? `Track your bike: ${trackingUrl}` : "",
    "",
    "Thank you,",
    "The Cycle Courier Co. Team",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

/** Sends the updates for one order. Returns per-side outcomes. */
async function sendUpdatesForOrder(
  admin: any,
  order: any,
  updates: Update[],
  recentSides: Set<string>
): Promise<{ sent: number; skipped: number; failed: number; results: any[] }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const results: any[] = [];

  for (const update of updates) {
    if (recentSides.has(update.side)) {
      skipped++;
      continue;
    }

    const contact = update.side === "sender" ? order.sender : order.receiver;
    const to = contact?.email;
    if (!to) {
      skipped++;
      continue;
    }

    const name = contact?.name || "Customer";

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          to,
          subject: update.subject,
          html: buildHtml(order, update, name),
          text: buildText(order, update, name),
          meta: { orderId: order.id, action: "customer_update", stage: update.stageKey },
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        failed++;
        results.push({ orderId: order.id, side: update.side, ok: false });
        continue;
      }

      if (payload?.skipped) {
        skipped++;
        continue;
      }

      await admin.from("order_update_log").insert({
        order_id: order.id,
        side: update.side,
        stage_key: update.stageKey,
        recipient: to,
        subject: update.subject,
      });

      recentSides.add(update.side);
      sent++;
      results.push({ orderId: order.id, side: update.side, stage: update.stageKey, ok: true });
    } catch (_err) {
      failed++;
      console.error("Failed to send customer update", {
        orderId: order.id,
        side: update.side,
        stage: update.stageKey,
      });
      results.push({ orderId: order.id, side: update.side, ok: false });
    }
  }

  return { sent, skipped, failed, results };
}

/** How many orders one invocation processes before handing over to the next. */
const CHUNK_SIZE = 40;

/**
 * Scans one chunk of orders. Runs inline for single orders, and as a
 * self-chaining chunk for cron/bulk so no single invocation can be cut short.
 */
async function runScan(admin: any, singleOrderId?: string, offset = 0) {
  const deadStatuses = ["delivered", "cancelled", "delivered_by_3p", "delivered_to_ferry"];
  const orders: any[] = [];
  let hasMore = false;

  if (singleOrderId) {
    const { data, error } = await admin.from("orders").select("*").eq("id", singleOrderId).single();
    if (error || !data) {
      return { notFound: true as const };
    }
    orders.push(data);
  } else {
    const { data, error } = await admin
      .from("orders")
      .select("*")
      .not("status", "in", `(${deadStatuses.join(",")})`)
      .order("created_at", { ascending: false })
      .range(offset, offset + CHUNK_SIZE - 1);
    if (error) throw error;
    orders.push(...(data || []));
    hasMore = (data?.length || 0) === CHUNK_SIZE;
  }


  // --- Inspection state: orders still in the workshop must not be chased
  // for delivery dates. Complete = an inspection row at 'inspected' or 'repaired'.
  const inspectionOrderIds = orders
    .filter((o) => o.needs_inspection === true)
    .map((o) => o.id);
  const inspectionComplete = new Set<string>();
  if (inspectionOrderIds.length > 0) {
    for (let i = 0; i < inspectionOrderIds.length; i += 200) {
      const chunk = inspectionOrderIds.slice(i, i + 200);
      const { data: insps, error: inspErr } = await admin
        .from("bicycle_inspections")
        .select("order_id, status")
        .in("order_id", chunk);
      if (inspErr) throw inspErr;
      for (const insp of insps || []) {
        if (insp.status === "repaired" || insp.status === "inspected") {
          inspectionComplete.add(insp.order_id);
        }
      }
    }
  }
  const isInspectionPending = (order: any): boolean =>
    order.needs_inspection === true && !inspectionComplete.has(order.id);

  const today = todayLondon();
  const cutoff = new Date(Date.now() - QUIET_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Pre-fetch the quiet window for this chunk in one query, not one per order.
  const quietSides = new Map<string, Set<string>>();
  if (!singleOrderId && orders.length > 0) {
    const { data, error } = await admin
      .from("order_update_log")
      .select("order_id, side")
      .gte("sent_at", cutoff)
      .in("order_id", orders.map((o) => o.id));
    if (error) throw error;
    for (const row of data || []) {
      const set = quietSides.get(row.order_id) || new Set<string>();
      set.add(row.side);
      quietSides.set(row.order_id, set);
    }
  }


  // --- Decide what each order needs -----------------------------------------
  type Task = { order: any; updates: Update[]; recentSides: Set<string> };
  const tasks: Task[] = [];
  let skipped = 0;

  for (const order of orders) {
    if (order.order_delivered && !singleOrderId) {
      skipped++;
      continue;
    }

    const updates = deriveUpdates(order, isInspectionPending(order));
    if (updates.length === 0) {
      skipped++;
      continue;
    }

    // Never double up on a day where a milestone email already went out.
    const milestoneToday =
      londonDay(order.collection_confirmation_sent_at) === today ||
      londonDay(order.delivery_confirmation_sent_at) === today ||
      londonDay(order.ferry_confirmation_sent_at) === today;

    if (milestoneToday && !singleOrderId) {
      skipped++;
      continue;
    }

    tasks.push({
      order,
      updates,
      recentSides: new Set(singleOrderId ? [] : quietSides.get(order.id) || []),
    });
  }

  // --- Send, in small parallel batches --------------------------------------
  const BATCH = 5;
  let sent = 0;
  let failed = 0;
  const results: any[] = [];

  for (let i = 0; i < tasks.length; i += BATCH) {
    const batch = tasks.slice(i, i + BATCH);
    const outcomes = await Promise.all(
      batch.map((t) => sendUpdatesForOrder(admin, t.order, t.updates, t.recentSides))
    );
    for (const o of outcomes) {
      sent += o.sent;
      skipped += o.skipped;
      failed += o.failed;
      if (singleOrderId) results.push(...o.results);
    }
  }

  console.log(
    `Customer updates complete: scanned=${orders.length} due=${tasks.length} sent=${sent} skipped=${skipped} failed=${failed}`
  );

  return { scanned: orders.length, due: tasks.length, sent, skipped, failed, results };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const singleOrderId: string | undefined = body?.orderId;

    // --- Auth: cron secret, or an authenticated internal staff member -------
    const cronSecret = req.headers.get("x-cron-secret");
    let authorised = false;

    if (cronSecret) {
      const { data: storedSecret } = await admin.rpc("get_cron_secret");
      authorised = !!storedSecret && cronSecret === storedSecret;
    } else {
      const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      if (token) {
        const { data: userData } = await admin.auth.getUser(token);
        if (userData?.user) {
          const { data: isStaff } = await admin.rpc("is_internal_staff", { _user_id: userData.user.id });
          authorised = !!isStaff;
        }
      }
    }

    if (!authorised) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Single-order manual sends stay synchronous so the UI gets the outcome.
    if (singleOrderId) {
      const outcome = await runScan(admin, singleOrderId);
      if ((outcome as any).notFound) {
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const o = outcome as any;
      return new Response(
        JSON.stringify({ success: true, scanned: o.scanned, sent: o.sent, skipped: o.skipped, results: o.results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Bulk/cron: acknowledge straight away and finish the scan in the
    // background, so a caller timing out can no longer truncate the run.
    const work = (async () => {
      try {
        await runScan(admin);
      } catch (error) {
        const err = error as any;
        console.error("send-order-updates background run failed:", {
          message: (error instanceof Error ? error.message : err?.message) || "unknown",
          code: err?.code || err?.status || null,
        });
      }
    })();

    // @ts-ignore EdgeRuntime is provided by the Supabase edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(work);
    } else {
      await work;
    }

    return new Response(JSON.stringify({ success: true, accepted: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 202,
    });
  } catch (error) {
    const err = error as any;
    const message =
      (error instanceof Error ? error.message : err?.message) || "Failed to send updates";
    const code = err?.code || err?.status || null;
    console.error("send-order-updates failed:", { message, code });
    return new Response(JSON.stringify({ error: message, code }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

