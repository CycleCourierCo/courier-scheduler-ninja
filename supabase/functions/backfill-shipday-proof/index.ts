import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { fetchShipdayProof, saveShipdayProof } from "../_shared/shipdayProof.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("SHIPDAY_API_KEY");
  if (!apiKey) return json({ error: "Shipday not configured" }, 500);
  const supabase = createClient(url, serviceKey);

  // Admin only (or service role).
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const given = req.headers.get("x-cron-secret");
  let cronOk = false;
  if (given) {
    const { data: expected } = await supabase.rpc("get_cron_secret");
    cronOk = !!expected && given === expected;
  }
  if (token !== serviceKey && !cronOk) {
    const { data: u } = await supabase.auth.getUser(token);
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const { data: p } = await supabase.from("profiles").select("role").eq("id", u.user.id).single();
    if (p?.role !== "admin") return json({ error: "Forbidden" }, 403);
  }

  let body: { tracking_number?: string; days?: number; limit?: number } = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const probe = (body as any).probe_id;
  if (probe) {
    const res = await fetch(`https://api.shipday.com/orders/${encodeURIComponent(String(probe).slice(0, 60))}`, { headers: { Authorization: `Basic ${apiKey}` } });
    const j = await res.json().catch(() => null);
    const paths: string[] = [];
    const walk = (n: any, k: string) => {
      if (n && typeof n === "object") { for (const [kk, v] of Object.entries(n)) walk(v, `${k}.${kk}`); return; }
      if (typeof n === "string" && /^https?:/.test(n)) paths.push(k);
    };
    walk(j, "");
    const o = Array.isArray(j) ? j[0] : j;
    return json({ http: res.status, isArray: Array.isArray(j), len: Array.isArray(j) ? j.length : null, urlKeys: paths, topKeys: o ? Object.keys(o) : null });
  }
  const days = Math.min(Math.max(Number(body.days) || 30, 1), 90);
  const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 300);

  let q = supabase.from("orders")
    .select("id, tracking_number, shipday_pickup_id, shipday_delivery_id, order_collected, order_delivered, tracking_events");
  if (body.tracking_number) q = q.eq("tracking_number", String(body.tracking_number).slice(0, 40));
  else q = q.eq("order_collected", true).gte("updated_at", new Date(Date.now() - days * 864e5).toISOString())
    .order("updated_at", { ascending: false }).limit(1000);
  const { data: orders, error } = await q;
  if (error) return json({ error: "Query failed" }, 500);

  const results: Array<{ tracking_number: string; leg: string; result: string }> = [];
  let checked = 0;
  for (const o of orders || []) {
    if (checked >= limit) break;
    const updates: any[] = o.tracking_events?.shipday?.updates || [];
    const legs: Array<["pickup" | "delivery", string | null, boolean]> = [
      ["pickup", o.shipday_pickup_id, !!o.order_collected],
      ["delivery", o.shipday_delivery_id, !!o.order_delivered],
    ];
    for (const [leg, sid, done] of legs) {
      if (!done || !sid) continue;
      const has = updates.some((u) => u?.leg === leg && ((u.podUrls?.length ?? 0) > 0 || u.signatureUrl));
      if (has) continue;
      checked++;
      const proof = await fetchShipdayProof(apiKey, String(sid));
      if (!proof) { results.push({ tracking_number: o.tracking_number, leg, result: "shipday_error" }); continue; }
      const saved = await saveShipdayProof(supabase, o.id, String(sid), leg, proof);
      results.push({ tracking_number: o.tracking_number, leg, result: saved ? "saved" : "none_in_shipday" });
    }
  }
  return json({ checked, saved: results.filter((r) => r.result === "saved").length, results });
});
