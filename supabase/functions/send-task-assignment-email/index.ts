import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/cors.ts";

const BASE_URL = "https://booking.cyclecourierco.com";
const FROM = "CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>";
const REPLY_TO = "Info@cyclecourierco.com";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: isStaff } = await admin.rpc("is_internal_staff", { _user_id: user.id });
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const taskId = typeof body?.taskId === "string" ? body.taskId.trim() : "";
    if (!taskId || !/^[0-9a-f-]{36}$/i.test(taskId)) {
      return json({ error: "A valid taskId is required" }, 400);
    }

    const { data: task, error: taskError } = await admin
      .from("tasks")
      .select("id, title, description, priority, due_date, assignee_id, created_by, linked_order_id, status")
      .eq("id", taskId)
      .maybeSingle();
    if (taskError) throw taskError;
    if (!task) return json({ error: "Task not found" }, 404);
    if (!task.assignee_id) return json({ skipped: "no assignee" });
    if (task.assignee_id === user.id) return json({ skipped: "self assignment" });

    const { data: assignee } = await admin
      .from("profiles")
      .select("id, name, email")
      .eq("id", task.assignee_id)
      .maybeSingle();
    const to = assignee?.email;
    if (!to) return json({ skipped: "assignee has no email" });

    let assignedBy = "A colleague";
    if (task.created_by) {
      const { data: creator } = await admin
        .from("profiles")
        .select("name, email")
        .eq("id", task.created_by)
        .maybeSingle();
      assignedBy = creator?.name || creator?.email || assignedBy;
    }

    let orderLine = "";
    if (task.linked_order_id) {
      const { data: order } = await admin
        .from("orders")
        .select("tracking_number")
        .eq("id", task.linked_order_id)
        .maybeSingle();
      if (order?.tracking_number) {
        orderLine = `<p style="margin:0 0 8px"><strong>Order:</strong> ${esc(order.tracking_number)}</p>`;
      }
    }

    if (!resendKey) return json({ error: "Email is not configured" }, 500);
    const resend = new Resend(resendKey);

    const due = task.due_date
      ? new Date(task.due_date).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" })
      : "No due date";

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:600px">
        <h2 style="margin:0 0 12px">You've been assigned a task</h2>
        <p style="margin:0 0 16px">${esc(assignedBy)} assigned this task to you.</p>
        <div style="border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin-bottom:16px">
          <p style="margin:0 0 8px;font-size:16px"><strong>${esc(task.title || "Task")}</strong></p>
          ${task.description ? `<p style="margin:0 0 8px;white-space:pre-wrap">${esc(String(task.description))}</p>` : ""}
          <p style="margin:0 0 8px"><strong>Priority:</strong> ${esc(String(task.priority || "normal"))}</p>
          <p style="margin:0 0 8px"><strong>Due:</strong> ${esc(due)}</p>
          ${orderLine}
        </div>
        <p style="margin:0 0 16px">
          <a href="${BASE_URL}/tasks" style="background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">Open your tasks</a>
        </p>
        <p style="margin:0;color:#666;font-size:12px">Cycle Courier Co.</p>
      </div>`;

    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: [to],
      reply_to: REPLY_TO,
      subject: `New task assigned: ${task.title || "Task"}`,
      html,
    });
    if (sendError) {
      console.error("Resend error sending task assignment email:", sendError);
      return json({ error: "Failed to send email" }, 502);
    }

    return json({ success: true });
  } catch (err) {
    console.error("send-task-assignment-email failed:", err instanceof Error ? err.message : "unknown error");
    return json({ error: "Unexpected error" }, 500);
  }
});
