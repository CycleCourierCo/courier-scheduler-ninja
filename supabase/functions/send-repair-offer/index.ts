import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/cors.ts";

const BASE_URL = "https://booking.cyclecourierco.com";
const FROM = "CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>";
const REPLY_TO = "Info@cyclecourierco.com";
const WHATSAPP_FROM = "441217980767";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("44")) return `+${digits}`;
  if (digits.startsWith("0")) return `+44${digits.slice(1)}`;
  return `+${digits}`;
};

const money = (n: number) => `£${Number(n || 0).toFixed(2)}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // --- Auth: admin or mechanic only ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    let allowed = false;
    for (const role of ["admin", "mechanic"]) {
      const { data: ok } = await admin.rpc("has_role", { _user_id: user.id, _role: role });
      if (ok) { allowed = true; break; }
    }
    if (!allowed) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
      return json({ error: "A valid orderId is required" }, 400);
    }

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, tracking_number, bike_brand, bike_model, receiver, is_test_account")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: "Order not found" }, 404);

    const { data: issues, error: issuesError } = await admin
      .from("inspection_issues")
      .select("id, issue_description, estimated_cost, status, billing_party, receiver_declined_at")
      .eq("order_id", orderId);
    if (issuesError) throw issuesError;

    const declined = (issues || []).filter(
      (i: any) => i.status === "declined" && !i.receiver_declined_at
    );
    const approved = (issues || []).filter(
      (i: any) =>
        ["approved", "resolved", "repaired"].includes(i.status) && i.billing_party === "customer"
    );

    if (declined.length === 0) {
      return json({ error: "There are no declined repairs to offer" }, 400);
    }

    const receiver = (order.receiver || {}) as Record<string, string>;
    const receiverEmail = (receiver.email || "").trim();
    const receiverPhone = (receiver.phone || "").trim();
    const receiverName = (receiver.name || "there").trim();
    if (!receiverEmail && !receiverPhone) {
      return json({ error: "The receiver has no email or phone on this order" }, 400);
    }

    const total = declined.reduce((s: number, i: any) => s + Number(i.estimated_cost || 0), 0);
    const bike = [order.bike_brand, order.bike_model].filter(Boolean).join(" ") || "your bike";
    const link = `${BASE_URL}/repair-offer/${order.id}`;

    // Stamp the offer before sending so the public page can serve the offer.
    const { error: stampError } = await admin
      .from("inspection_issues")
      .update({
        offered_to_receiver_at: new Date().toISOString(),
        offered_to_receiver_by_id: user.id,
        offered_to_receiver_by_name: (user.user_metadata as any)?.name || user.email || "Staff",
        updated_at: new Date().toISOString(),
      })
      .in("id", declined.map((i: any) => i.id));
    if (stampError) throw stampError;

    // Test accounts: record the offer but don't message anyone.
    if ((order as any).is_test_account === true) {
      return json({ success: true, skipped: "test_account", offered: declined.length, link });
    }

    const results: Record<string, unknown> = { offered: declined.length, link };

    // --- Email ---
    if (receiverEmail) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        results.email = "not_configured";
      } else {
        const resend = new Resend(resendKey);
        const approvedHtml = approved.length
          ? `<p style="margin:0 0 8px"><strong>The customer has approved the following repairs:</strong></p>
             <ul>${approved.map((i: any) => `<li>${i.issue_description}</li>`).join("")}</ul>`
          : `<p style="margin:0 0 8px"><strong>The customer hasn't approved any of the recommended repairs.</strong></p>`;
        const declinedHtml = `<p style="margin:16px 0 8px"><strong>…but has not approved the following:</strong></p>
             <ul>${declined
               .map((i: any) => `<li>${i.issue_description} — ${money(Number(i.estimated_cost || 0))}</li>`)
               .join("")}</ul>
             <p style="margin:8px 0 0">Total if all are done: <strong>${money(total)}</strong></p>`;

        const html = `
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;line-height:1.5">
            <p>Hi ${receiverName},</p>
            <p>While preparing <strong>${bike}</strong> (job #${order.tracking_number}) for delivery, our workshop found some work it needs.</p>
            ${approvedHtml}
            ${declinedHtml}
            <p style="margin:20px 0">Would you like us to do those repairs while we still have the bike?</p>
            <p><a href="${link}" style="background:#0f766e;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">Choose the repairs you'd like</a></p>
            <p style="font-size:13px;color:#4b5563;margin-top:20px">Any repairs you approve here are paid by you directly (not by the seller) — we'll be in touch about payment before delivery. If you'd rather not, just choose "No thanks" on that page.</p>
            <p style="font-size:13px;color:#4b5563">Thanks,<br/>CCC - Cycle Courier Co.</p>
          </div>`;

        const { error: emailError } = await resend.emails.send({
          from: FROM,
          to: [receiverEmail],
          subject: `Optional repairs for your bike — job #${order.tracking_number}`,
          html,
          reply_to: REPLY_TO,
        });
        if (emailError) {
          console.error("Repair offer email failed:", emailError.message);
          results.email = "failed";
        } else {
          results.email = "sent";
        }
      }
    }

    // --- WhatsApp ---
    if (receiverPhone) {
      const sendzenKey = Deno.env.get("SENDZEN_API_KEY");
      const to = normalizePhone(receiverPhone);
      if (!sendzenKey || !to) {
        results.whatsapp = "not_configured";
      } else {
        const lines = [
          `Hi ${receiverName}, this is CCC - Cycle Courier Co. about your bike (job #${order.tracking_number}).`,
          "",
          approved.length
            ? `The customer has approved these repairs: ${approved.map((i: any) => i.issue_description).join(", ")}.`
            : "The customer hasn't approved any of the recommended repairs.",
          "",
          `They have not approved: ${declined
            .map((i: any) => `${i.issue_description} (${money(Number(i.estimated_cost || 0))})`)
            .join(", ")}.`,
          "",
          `Would you like us to do those repairs? Total ${money(total)}, paid by you directly.`,
          "",
          `Choose here: ${link}`,
        ];
        try {
          const res = await fetch("https://api.sendzen.io/v1/messages", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sendzenKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to,
              from: WHATSAPP_FROM,
              type: "text",
              text: { body: lines.join("\n") },
            }),
          });
          if (!res.ok) {
            console.error("Repair offer WhatsApp failed:", res.status, await res.text());
            results.whatsapp = "failed";
          } else {
            results.whatsapp = "sent";
          }
        } catch (err) {
          console.error("Repair offer WhatsApp error:", (err as Error).message);
          results.whatsapp = "failed";
        }
      }
    }

    return json({ success: true, ...results });
  } catch (err) {
    console.error("send-repair-offer error:", (err as Error).message);
    return json({ error: "Failed to send repair offer" }, 500);
  }
});
