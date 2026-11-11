// Endpoint class: PUBLIC — customer lost-item reports. Requires tracking number +
// a matching sender/receiver postcode so strangers can't attach reports to orders.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const norm = (p: unknown) => String(p ?? "").replace(/\s+/g, "").toUpperCase();
const Body = z.object({
  tracking: z.string().trim().toUpperCase().min(6).max(40),
  postcode: z.string().trim().min(2).max(10),
  itemName: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().default(""),
  photo: z.object({ type: z.enum(["image/jpeg", "image/png", "image/webp"]), data: z.string().max(7_000_000) }).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (Number(req.headers.get("content-length") || 0) > 7_500_000) return json({ error: "Photo is too large (max 5 MB)" }, 413);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Please check the form and try again" }, 400);
  const b = parsed.data;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const { data: order } = await admin.from("orders").select("id, sender, receiver")
      .or(`tracking_number.eq.${b.tracking.replace(/[^A-Z0-9-]/g, "")},customer_order_number.eq.${b.tracking.replace(/[^A-Z0-9-]/g, "")}`)
      .limit(1).maybeSingle();
    const pc = norm(b.postcode);
    const ok = order && [order.sender?.address?.zipCode, order.receiver?.address?.zipCode].some((z: unknown) => norm(z) === pc);
    if (!ok) return json({ error: "We couldn't match that tracking number and postcode" }, 404);
    const since = new Date(Date.now() - 864e5).toISOString();
    const { count } = await admin.from("lost_found_items").select("id", { count: "exact", head: true })
      .eq("order_id", order.id).eq("source", "customer").gte("created_at", since);
    if ((count ?? 0) >= 5) return json({ error: "Too many reports for this order today. Please contact us instead." }, 429);
    const { data: item, error } = await admin.from("lost_found_items").insert({
      order_id: order.id, item_name: b.itemName, description: b.description, item_type: "lost",
      source: "customer", created_by: null, reporter_name: b.name, reporter_email: b.email, reporter_phone: b.phone || null,
    }).select("id").single();
    if (error) throw error;
    if (b.photo) {
      const bytes = Uint8Array.from(atob(b.photo.data), (c) => c.charCodeAt(0));
      if (bytes.length <= 5 * 1024 * 1024) {
        const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[b.photo.type];
        const path = `${item.id}/${crypto.randomUUID()}.${ext}`;
        const up = await admin.storage.from("lost-found-photos").upload(path, bytes, { contentType: b.photo.type });
        if (!up.error) await admin.from("lost_found_items").update({ photo_path: path }).eq("id", item.id);
      }
    }
    return json({ success: true });
  } catch {
    console.error("submit-lost-item failed");
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
