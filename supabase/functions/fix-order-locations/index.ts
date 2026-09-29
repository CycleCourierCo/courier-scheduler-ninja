import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAdminOrCronAuth, createAuthErrorResponse } from "../_shared/auth.ts";

// Moves open jobs' map pins to their postcode when the pin is > 15 km away
// (street lookups sometimes pick a same-named town elsewhere).
const MAX_KM = 15;

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const t = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(t(b.lat - a.lat) / 2) ** 2 +
    Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(t(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const norm = (p: unknown) => String(p ?? "").toUpperCase().replace(/\s+/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdminOrCronAuth(req);
  if (!auth.success) return createAuthErrorResponse(auth.error!, auth.status!);

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const orders: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("orders")
        .select("id, sender, receiver, order_collected, order_delivered, status")
        .or("order_delivered.is.null,order_delivered.eq.false")
        .not("status", "in", "(cancelled,delivered)")
        .range(from, from + 999);
      if (error) throw error;
      orders.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    const pcs = new Set<string>();
    for (const o of orders) {
      if (!o.order_collected && o.sender?.address?.zipCode) pcs.add(norm(o.sender.address.zipCode));
      if (o.receiver?.address?.zipCode) pcs.add(norm(o.receiver.address.zipCode));
    }
    const pcMap = new Map<string, { lat: number; lon: number }>();
    const list = [...pcs].filter((p) => p.length >= 5);
    for (let i = 0; i < list.length; i += 100) {
      const r = await fetch("https://api.postcodes.io/postcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcodes: list.slice(i, i + 100) }),
      });
      if (!r.ok) continue;
      const d = await r.json();
      for (const row of d?.result ?? []) {
        if (row?.result?.latitude != null) {
          pcMap.set(norm(row.query), { lat: row.result.latitude, lon: row.result.longitude });
        }
      }
    }

    let fixed = 0;
    const fixedIds: string[] = [];
    for (const o of orders) {
      const patch: Record<string, unknown> = {};
      for (const side of ["sender", "receiver"] as const) {
        if (side === "sender" && o.order_collected) continue;
        const a = o[side]?.address;
        const pc = a ? pcMap.get(norm(a.zipCode)) : undefined;
        if (!pc) continue;
        const lat = Number(a.lat), lon = Number(a.lon);
        const bad = !Number.isFinite(lat) || !Number.isFinite(lon) || km({ lat, lon }, pc) > MAX_KM;
        if (bad) patch[side] = { ...o[side], address: { ...a, lat: pc.lat, lon: pc.lon } };
      }
      if (Object.keys(patch).length) {
        fixed++;
        fixedIds.push(o.id);
        if (!dryRun) {
          const { error } = await db.from("orders").update(patch).eq("id", o.id);
          if (error) console.error("update failed", { id: o.id, code: error.code });
        }
      }
    }
    console.log("fix-order-locations", { checked: orders.length, fixed, dryRun });
    return new Response(JSON.stringify({ checked: orders.length, fixed, dryRun, orderIds: fixedIds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fix-order-locations failed", { message: (e as Error).message });
    return new Response(JSON.stringify({ error: "Failed to fix locations" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
