import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Recurrence {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  assignee_id: string | null;
  assignee_role: string | null;
  frequency: string;
  interval_n: number;
  days_of_week: number[] | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
}

const londonToday = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

function startOfWeek(d: Date): Date {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const shift = (copy.getUTCDay() + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - shift);
  return copy;
}

function matches(r: Recurrence, dateStr: string): boolean {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const start = new Date(`${r.start_date}T00:00:00Z`);
  if (date < start) return false;
  if (r.end_date && date > new Date(`${r.end_date}T00:00:00Z`)) return false;
  const dow = date.getUTCDay();
  const interval = Math.max(1, r.interval_n || 1);
  const days = r.days_of_week || [];

  switch (r.frequency) {
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "days_of_week":
      return days.includes(dow);
    case "weekly": {
      const use = days.length ? days : [start.getUTCDay()];
      if (!use.includes(dow)) return false;
      const weeks = Math.floor(
        (startOfWeek(date).getTime() - startOfWeek(start).getTime()) / (7 * 86400000),
      );
      return weeks % interval === 0;
    }
    case "monthly": {
      if (date.getUTCDate() !== start.getUTCDate()) return false;
      const months =
        (date.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        (date.getUTCMonth() - start.getUTCMonth());
      return months % interval === 0;
    }
    default:
      return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Auth: cron secret, or a signed-in admin / project manager.
  const cronSecret = req.headers.get("x-cron-secret");
  const expected = Deno.env.get("CRON_SECRET");
  let authorised = !!expected && cronSecret === expected;

  if (!authorised) {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorised" }, 401);
    const { data: userData } = await admin.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "Unauthorised" }, 401);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    authorised = (roles || []).some((r: any) => r.role === "admin" || r.role === "project_manager");
    if (!authorised) return json({ error: "Forbidden" }, 403);
  }

  const today = londonToday();

  const { data: recurrences, error } = await admin
    .from("task_recurrences")
    .select("*")
    .eq("active", true);
  if (error) return json({ error: error.message }, 500);

  let created = 0;

  for (const r of (recurrences || []) as Recurrence[]) {
    if (!matches(r, today)) continue;

    // Who should get it?
    let assignees: (string | null)[] = [r.assignee_id ?? null];
    if (r.assignee_role) {
      const { data: holders } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", r.assignee_role);
      assignees = (holders || []).map((h: any) => h.user_id);
      if (assignees.length === 0) assignees = [null];
    }

    for (const assignee of assignees) {
      let existing = admin
        .from("tasks")
        .select("id")
        .eq("recurrence_id", r.id)
        .eq("planned_date", today);
      existing = assignee ? existing.eq("assignee_id", assignee) : existing.is("assignee_id", null);
      const { data: dupe } = await existing.limit(1);
      if (dupe && dupe.length) continue;

      const { error: insertError } = await admin.from("tasks").insert({
        title: r.title,
        description: r.description,
        category: r.category,
        priority: r.priority,
        status: "open",
        assignee_id: assignee,
        planned_date: today,
        due_date: `${today}T17:00:00Z`,
        recurrence_id: r.id,
      });
      if (insertError) {
        console.error("Failed to create recurring task", insertError.message);
        continue;
      }
      created++;
    }

    await admin
      .from("task_recurrences")
      .update({ last_generated_on: today })
      .eq("id", r.id);
  }

  return json({ ok: true, date: today, created });
});
