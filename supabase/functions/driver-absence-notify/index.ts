import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/cors.ts";
import { trackResend } from "../_shared/integrationLog.ts";
import { emailShell, htmlToPlainText } from "../_shared/emailLayout.ts";

const BASE_URL = "https://booking.cyclecourierco.com";
const FROM = "CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>";
const REPLY_TO = "Info@cyclecourierco.com";
const LABELS: Record<string, string> = { holiday: "Holiday", sick: "Sick", unpaid: "Unpaid leave", other: "Other" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const { data: { user } } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const requestId = typeof body?.requestId === "string" ? body.requestId : "";
    const event = body?.event;
    if (!/^[0-9a-f-]{36}$/i.test(requestId) || !["submitted", "decided", "cancel_requested"].includes(event)) {
      return json({ error: "Invalid input" }, 400);
    }

    const { data: r } = await admin.from("driver_absence_requests").select("*").eq("id", requestId).maybeSingle();
    if (!r) return json({ error: "Not found" }, 404);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (r.driver_id !== user.id && !isAdmin) return json({ error: "Forbidden" }, 403);

    const { data: driver } = await admin.from("profiles").select("name, email").eq("id", r.driver_id).maybeSingle();
    const dates = r.start_date === r.end_date ? fmt(r.start_date) : `${fmt(r.start_date)} – ${fmt(r.end_date)}`;
    const who = esc(driver?.name || driver?.email || "A driver");

    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return json({ error: "Email is not configured" }, 500);
    const resend = trackResend(new Resend(key), "driver absence");

    let to: string[] = [];
    let subject = "";
    let inner = "";
    if (event === "submitted" || event === "cancel_requested") {
      const [{ data: roleRows }, { data: legacy }] = await Promise.all([
        admin.from("user_roles").select("user_id").eq("role", "admin"),
        admin.from("profiles").select("id").eq("role", "admin"),
      ]);
      const ids = Array.from(new Set([...(roleRows || []).map((x: any) => x.user_id), ...(legacy || []).map((x: any) => x.id)]));
      if (ids.length) {
        const { data: admins } = await admin.from("profiles").select("email, is_active").in("id", ids);
        to = (admins || []).filter((a: any) => a.email && a.is_active !== false).map((a: any) => a.email);
      }
      subject = event === "submitted" ? `Absence request: ${driver?.name || "driver"} (${dates})` : `Cancellation requested: ${driver?.name || "driver"} (${dates})`;
      inner = `<h2 style="margin:0 0 12px">${event === "submitted" ? "New absence request" : "Driver asked to cancel approved leave"}</h2>
        <p style="margin:0 0 8px"><strong>${who}</strong> · ${esc(LABELS[r.type] || r.type)}</p>
        <p style="margin:0 0 16px">${esc(dates)}</p>
        <p><a href="${BASE_URL}/users" style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">Review in User Management</a></p>`;
    } else {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      if (!driver?.email) return json({ skipped: "no driver email" });
      to = [driver.email];
      const word = r.status === "approved" ? "approved" : r.status === "declined" ? "declined" : "cancelled";
      subject = `Your ${(LABELS[r.type] || "absence").toLowerCase()} for ${dates} has been ${word}`;
      inner = `<h2 style="margin:0 0 12px">Your request has been ${word}</h2>
        <p style="margin:0 0 8px">${esc(LABELS[r.type] || r.type)} · ${esc(dates)}</p>
        ${r.decision_reason ? `<p style="margin:0 0 16px">${esc(String(r.decision_reason))}</p>` : ""}
        <p><a href="${BASE_URL}/my-holidays" style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">View my holidays</a></p>`;
    }
    if (!to.length) return json({ skipped: "no recipients" });

    const html = emailShell(inner, { subject, eyebrow: "ROTA", legalFooter: false });
    const { error } = await resend.emails.send({ from: FROM, to, reply_to: REPLY_TO, subject, html, text: htmlToPlainText(html) });
    if (error) { console.error("driver-absence-notify send failed"); return json({ error: "Failed to send email" }, 502); }
    return json({ success: true });
  } catch (e) {
    console.error("driver-absence-notify failed:", e instanceof Error ? e.message : "unknown");
    return json({ error: "Unexpected error" }, 500);
  }
});
