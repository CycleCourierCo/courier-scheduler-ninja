import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { corsHeaders } from "../_shared/cors.ts";

const ALLOWED_BUCKETS = new Set([
  "foam-my-bike-labels",
  "foam-delivery-photos",
  "box-my-bike-labels",
]);

const STAFF_ROLES = ["admin", "loader", "mechanic", "route_planner", "cs_agent", "timeslip_admin"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function decodeBase64(base64: string): Uint8Array {
  const cleaned = base64.includes(",") ? base64.split(",").pop() || "" : base64;
  const binary = atob(cleaned.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function parseUploadRequest(req: Request): Promise<{
  bucket: string;
  path: string;
  bytes: Uint8Array;
  contentType: string;
}> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null) as {
      bucket?: unknown;
      path?: unknown;
      base64?: unknown;
      contentType?: unknown;
    } | null;
    const base64 = typeof body?.base64 === "string" ? body.base64 : "";
    return {
      bucket: typeof body?.bucket === "string" ? body.bucket : "",
      path: typeof body?.path === "string" ? body.path : "",
      bytes: base64 ? decodeBase64(base64) : new Uint8Array(),
      contentType: typeof body?.contentType === "string" ? body.contentType : "application/octet-stream",
    };
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return {
      bucket: String(form.get("bucket") || ""),
      path: String(form.get("path") || ""),
      bytes: new Uint8Array(),
      contentType: "application/octet-stream",
    };
  }

  return {
    bucket: String(form.get("bucket") || ""),
    path: String(form.get("path") || ""),
    bytes: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type || "application/octet-stream",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Invalid session" }, 401);
    const userId = userData.user.id;

    const { bucket, path, bytes, contentType } = await parseUploadRequest(req);

    if (!ALLOWED_BUCKETS.has(bucket)) return json({ error: "Unsupported bucket" }, 400);
    if (!path || path.includes("..") || !path.includes("/")) {
      return json({ error: "Invalid path" }, 400);
    }
    if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) {
      return json({ error: "File must be between 1 byte and 20MB" }, 400);
    }

    // Authorisation mirrors the storage RLS policies: staff, or the order owner.
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isStaff = (roles || []).some((r: { role: string }) => STAFF_ROLES.includes(r.role));

    if (!isStaff) {
      const orderId = path.split("/")[0];
      const { data: order } = await admin
        .from("orders")
        .select("id")
        .eq("id", orderId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!order) return json({ error: "Not allowed to upload for this order" }, 403);
    }

    const { error: uploadError } = await admin.storage.from(bucket).upload(path, bytes, {
      upsert: true,
      contentType,
    });
    if (uploadError) {
      console.error("[upload-file] storage error", uploadError.message);
      return json({ error: "Storage rejected the upload" }, 502);
    }

    return json({ path });
  } catch (e) {
    console.error("[upload-file] unexpected error", (e as Error)?.message);
    return json({ error: "Upload failed" }, 500);
  }
});
