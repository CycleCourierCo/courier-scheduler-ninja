/**
 * send-internal-reports
 *
 * Emails internal operational summaries to the office:
 *  - customer-updates   daily digest of proactive customer update emails
 *  - daily-ops          previous-day operations snapshot
 *  - weekly-driver      previous Mon-Sun driver report
 *  - weekly-van         previous Mon-Sun fleet report
 *  - weekly-workshop    previous Mon-Sun inspection/repair report
 *
 * Auth: X-Cron-Secret for scheduled runs, or an admin JWT for manual sends.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  addDays,
  buildCustomerUpdateReport,
  buildDailyOpsReport,
  buildWeeklyDriverReport,
  buildWeeklyVanReport,
  buildWeeklyWorkshopReport,
  lastWeek,
  londonDate,
} from "./reports.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const RECIPIENTS = ["Info@cyclecourierco.com"];

const REPORTS = ["customer-updates", "daily-ops", "weekly-driver", "weekly-van", "weekly-workshop"] as const;
type ReportName = (typeof REPORTS)[number];

const sendEmail = async (subject: string, html: string) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Cycle Courier Co. <Ccc@notification.cyclecourierco.com>",
      to: RECIPIENTS,
      reply_to: "Info@cyclecourierco.com",
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend failed [${res.status}]: ${body}`);
  }
  return await res.json();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const report = String(body?.report || "") as ReportName;

    if (!REPORTS.includes(report)) {
      return new Response(JSON.stringify({ error: `report must be one of ${REPORTS.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- auth ---------------------------------------------------------------
    const cronSecret = req.headers.get("x-cron-secret");
    let authorised = false;
    if (cronSecret) {
      const { data: stored } = await admin.rpc("get_cron_secret");
      authorised = !!stored && cronSecret === stored;
    } else {
      const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      if (token) {
        const { data: userData } = await admin.auth.getUser(token);
        if (userData?.user) {
          const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
          authorised = !!isAdmin;
        }
      }
    }
    if (!authorised) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- date window --------------------------------------------------------
    const today = londonDate();
    const date: string = body?.date || (report === "customer-updates" ? today : addDays(today, -1));
    const week = body?.start && body?.end ? { start: body.start, end: body.end } : lastWeek(today);

    let built: { subject: string; html: string };
    switch (report) {
      case "customer-updates":
        built = await buildCustomerUpdateReport(admin, date);
        break;
      case "daily-ops":
        built = await buildDailyOpsReport(admin, date);
        break;
      case "weekly-driver":
        built = await buildWeeklyDriverReport(admin, week.start, week.end);
        break;
      case "weekly-van":
        built = await buildWeeklyVanReport(admin, week.start, week.end);
        break;
      case "weekly-workshop":
        built = await buildWeeklyWorkshopReport(admin, week.start, week.end);
        break;
    }

    await sendEmail(built.subject, built.html);
    console.log(`Internal report sent: ${report}`);

    return new Response(JSON.stringify({ success: true, report, subject: built.subject }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const err = error as any;
    const message = (error instanceof Error ? error.message : err?.message) || "Failed to send report";
    console.error("send-internal-reports failed:", { message, code: err?.code || null });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
