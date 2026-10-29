import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { corsHeaders } from "../_shared/cors.ts";
import { toPublicFileUrl } from "../_shared/publicFileUrl.ts";

/**
 * Returns short-lived signed URLs for an order's foam delivery photos after the
 * database verifies the receiver postcode and counts the attempt.
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
    const postcode = typeof body?.postcode === "string" ? body.postcode.trim() : "";
    if (!identifier || !postcode || identifier.length > 100 || postcode.length > 20) {
      return json({ error: "identifier and postcode are required" }, 400);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: proof, error: proofError } = await supabase.rpc("verify_foam_photo_access", {
      p_identifier: identifier,
      p_postcode: postcode,
    });
    if (proofError) {
      console.error("foam photo verification failed");
      return json({ error: "Could not load photos" }, 500);
    }
    if (proof?.rate_limited) return json({ urls: [], rate_limited: true }, 429);
    if (!proof?.verified) return json({ urls: [] }, 403);

    const paths: string[] = Array.isArray(proof.paths) ? proof.paths.filter((p: unknown) => typeof p === "string") : [];
    if (paths.length === 0) return json({ urls: [] });

    const { data, error } = await supabase.storage.from("foam-delivery-photos").createSignedUrls(paths, 60 * 30);
    if (error) {
      console.error("Failed to sign foam delivery photos");
      return json({ error: "Could not load photos" }, 500);
    }
    return json({ urls: (data || []).map((d) => toPublicFileUrl(d.signedUrl)).filter(Boolean) });
  } catch {
    console.error("get-foam-photo-urls failed");
    return json({ error: "Internal error" }, 500);
  }
});
