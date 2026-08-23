import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Returns short-lived signed URLs for an order's foam delivery photos.
 *
 * The photos live in a private bucket with no public read rule. Access is
 * granted only to a caller that can prove they know the order's delivery
 * (receiver) postcode — the same proof the public tracking page already uses
 * before revealing proof-of-delivery images.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalisePostcode = (value: unknown): string =>
  typeof value === "string" ? value.toUpperCase().replace(/\s+/g, "") : "";

const receiverPostcode = (receiver: any): string =>
  normalisePostcode(
    receiver?.postcode ??
      receiver?.zipCode ??
      receiver?.postal_code ??
      receiver?.address?.zipCode ??
      receiver?.address?.postcode ??
      receiver?.address?.postal_code,
  );

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => null);
    const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
    const postcode = typeof body?.postcode === "string" ? body.postcode.trim() : "";

    if (!identifier || !postcode || identifier.length > 100 || postcode.length > 20) {
      return json({ error: "identifier and postcode are required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const columns = "id, foam_delivery_photos, receiver";
    let order: any = null;

    if (UUID_RE.test(identifier)) {
      const { data } = await supabase.from("orders").select(columns).eq("id", identifier).maybeSingle();
      order = data;
    }
    if (!order) {
      const { data } = await supabase
        .from("orders")
        .select(columns)
        .ilike("tracking_number", identifier)
        .maybeSingle();
      order = data;
    }
    if (!order) {
      const { data } = await supabase
        .from("orders")
        .select(columns)
        .ilike("customer_order_number", identifier)
        .maybeSingle();
      order = data;
    }

    // Same response whether the order is missing or the postcode is wrong, so
    // callers cannot probe for valid tracking numbers.
    if (!order || receiverPostcode(order.receiver) !== normalisePostcode(postcode)) {
      return json({ urls: [] }, 403);
    }

    const paths: string[] = Array.isArray(order.foam_delivery_photos)
      ? order.foam_delivery_photos.filter((p: unknown) => typeof p === "string")
      : [];

    if (paths.length === 0) {
      return json({ urls: [] });
    }

    const { data, error } = await supabase.storage
      .from("foam-delivery-photos")
      .createSignedUrls(paths, 60 * 30);

    if (error) {
      console.error("Failed to sign foam delivery photos:", error.message);
      return json({ error: "Could not load photos" }, 500);
    }

    return json({
      urls: (data || []).map((d) => d.signedUrl).filter(Boolean),
    });
  } catch (e) {
    console.error("get-foam-photo-urls failed:", (e as Error).message);
    return json({ error: "Internal error" }, 500);
  }
});
