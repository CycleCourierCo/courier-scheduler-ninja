import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { sendSms, fitSms } from "../_shared/divergentSms.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.object({
  missingDates: z.enum(["sender", "receiver", "either"]),
  search: z.string().max(200).optional(),
  status: z.array(z.string().max(50)).max(30).optional(),
  bikeType: z.array(z.string().max(100)).max(50).optional(),
  customerId: z.string().uuid().optional(),
  dateFrom: z.string().max(40).optional(),
  dateTo: z.string().max(40).optional(),
});

const STAFF = ["admin", "cs_agent", "route_planner"];
const BASE = "https://booking.cyclecourierco.com";
const empty = (d: unknown) => !Array.isArray(d) || d.length === 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles || []).some((r: any) => STAFF.includes(r.role))) return json({ error: "Forbidden" }, 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const f = parsed.data;

    const SENDZEN_API_KEY = Deno.env.get("SENDZEN_API_KEY");
    if (!SENDZEN_API_KEY) return json({ error: "WhatsApp service not configured" }, 500);

    // Collect matching orders (paginated past the 1,000-row limit)
    const orders: any[] = [];
    for (let from = 0; ; from += 1000) {
      let q = admin
        .from("orders")
        .select("id, user_id, sender, receiver, pickup_date, delivery_date, needs_inspection")
        .not("status", "in", "(delivered,cancelled)");
      if (f.missingDates === "sender") q = q.or("pickup_date.is.null,pickup_date.eq.{}");
      else if (f.missingDates === "receiver") q = q.or("delivery_date.is.null,delivery_date.eq.{}");
      else q = q.or("pickup_date.is.null,pickup_date.eq.{},delivery_date.is.null,delivery_date.eq.{}");
      if (f.customerId) q = q.eq("user_id", f.customerId);
      if (f.status?.length) q = q.in("status", f.status as any);
      if (f.bikeType?.length) q = q.in("bike_type", f.bikeType);
      if (f.dateFrom) q = q.gte("created_at", f.dateFrom);
      if (f.dateTo) q = q.lte("created_at", f.dateTo);
      const s = f.search?.trim().replace(/[,()%\\]/g, "");
      if (s) {
        q = q.or(
          ["sender->>name", "receiver->>name", "sender->>email", "receiver->>email", "sender->>phone", "receiver->>phone",
            "tracking_number", "bike_brand", "bike_model", "customer_order_number"]
            .map((c) => `${c}.ilike.%${s}%`).join(","),
        );
      }
      const { data, error } = await q.order("created_at").range(from, from + 999);
      if (error) throw error;
      orders.push(...(data || []));
      if (!data || data.length < 1000) break;
    }

    // Test accounts
    const userIds = [...new Set(orders.map((o) => o.user_id).filter(Boolean))];
    const testUsers = new Set<string>();
    for (let i = 0; i < userIds.length; i += 200) {
      const { data } = await admin.from("profiles").select("id").in("id", userIds.slice(i, i + 200)).eq("is_test_account", true);
      (data || []).forEach((p: any) => testUsers.add(p.id));
    }

    // Recent chases (24h)
    const since = new Date(Date.now() - 86400000).toISOString();
    const recent = new Set<string>();
    const ids = orders.map((o) => o.id);
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await admin.from("date_chase_log").select("order_id, side")
        .in("order_id", ids.slice(i, i + 200)).eq("status", "sent").gte("sent_at", since);
      (data || []).forEach((r: any) => recent.add(`${r.order_id}:${r.side}`));
    }

    // Workshop gate: receivers aren't chased until every inspection is complete.
    const inspIds = orders.filter((o) => o.needs_inspection === true).map((o) => o.id);
    const inspByOrder = new Map<string, string[]>();
    for (let i = 0; i < inspIds.length; i += 200) {
      const { data, error } = await admin.from("bicycle_inspections").select("order_id, status")
        .in("order_id", inspIds.slice(i, i + 200));
      if (error) throw error;
      (data || []).forEach((r: any) => inspByOrder.set(r.order_id, [...(inspByOrder.get(r.order_id) || []), r.status]));
    }
    const workshopPending = (o: any) => {
      if (o.needs_inspection !== true) return false;
      const s = inspByOrder.get(o.id) || [];
      return s.length === 0 || !s.every((x) => x === "repaired" || x === "ship_as_is");
    };

    const counts = { sent: 0, failed: 0, smsSent: 0, smsFailed: 0, noPhone: 0, testAccount: 0, recentlyChased: 0, waitingOnSender: 0, awaitingWorkshop: 0 };
    const jobs: { order: any; side: "sender" | "receiver"; phone: string }[] = [];

    for (const o of orders) {
      const sides: ("sender" | "receiver")[] = [];
      const senderMissing = empty(o.pickup_date);
      const receiverMissing = empty(o.delivery_date);
      if (f.missingDates !== "receiver" && senderMissing) sides.push("sender");
      if (f.missingDates !== "sender" && receiverMissing) {
        if (senderMissing) counts.waitingOnSender++;
        else if (workshopPending(o)) counts.awaitingWorkshop++;
        else sides.push("receiver");
      }
      for (const side of sides) {
        if (o.user_id && testUsers.has(o.user_id)) { counts.testAccount++; continue; }
        if (recent.has(`${o.id}:${side}`)) { counts.recentlyChased++; continue; }
        const digits = String(o[side]?.phone || "").replace(/\D/g, "");
        if (digits.length < 8) { counts.noPhone++; continue; }
        const phone = digits.startsWith("0") ? `44${digits.slice(1)}` : digits;
        jobs.push({ order: o, side, phone: `+${phone}` });
      }
    }

    const send = async (j: (typeof jobs)[number]) => {
      const link = `${BASE}/${j.side}-availability/${j.order.id}`;
      let status = "sent";
      let err: string | null = null;
      try {
        const res = await fetch("https://api.sendzen.io/v1/messages", {
          method: "POST",
          headers: { Authorization: `Bearer ${SENDZEN_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            to: j.phone,
            from: "441217980767",
            type: "template",
            template: {
              name: "dates_chaser",
              lang_code: "en",
              components: [{ type: "body", parameters: [{ type: "text", text: link }] }],
            },
          }),
        });
        if (!res.ok) {
          status = "failed";
          err = `[${res.status}] ${(await res.text()).slice(0, 300)}`;
          console.error(`dates_chaser failed for order ${j.order.id}: ${err}`);
        }
      } catch (e) {
        status = "failed";
        err = String((e as Error).message).slice(0, 300);
      }
      if (status === "sent") counts.sent++; else counts.failed++;
      await admin.from("date_chase_log").insert({ order_id: j.order.id, side: j.side, status, error: err, sent_by: user.id });
      const leg = j.side === "sender" ? "collection" : "delivery";
      const sms = await sendSms(admin, {
        phone: j.phone,
        content: fitSms(`Cycle Courier Co: please enter 7 dates you're available for your bike ${leg} so we can book it:`, link),
        orderId: j.order.id, type: "dates_chaser", side: j.side,
        idempotencyKey: `${j.order.id}-dates-${j.side}-${new Date().toISOString().slice(0, 10)}`,
      });
      if (sms.ok) counts.smsSent++; else counts.smsFailed++;
    };

    for (let i = 0; i < jobs.length; i += 10) await Promise.all(jobs.slice(i, i + 10).map(send));

    return json({ success: true, matched: orders.length, ...counts });
  } catch (e) {
    console.error("chase-missing-dates error:", (e as Error).message);
    return json({ error: "Internal server error" }, 500);
  }
});
