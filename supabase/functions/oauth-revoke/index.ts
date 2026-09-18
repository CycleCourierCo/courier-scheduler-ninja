// Partner-initiated token revocation (RFC 7009 style).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { sha256Hex } from "../_shared/oauthTokens.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

  if (req.method !== "POST") {
    return json({ error: "invalid_request" }, 405);
  }

  let params: Record<string, string> = {};
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const parsed = await req.json();
      for (const [key, value] of Object.entries(parsed ?? {})) {
        if (typeof value === "string") params[key] = value;
      }
    } else {
      params = Object.fromEntries(new URLSearchParams(await req.text()).entries());
    }
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  let clientId = params.client_id?.trim() ?? "";
  let clientSecret = params.client_secret?.trim() ?? "";
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = atob(authHeader.slice(6));
      const separator = decoded.indexOf(":");
      if (separator > 0) {
        clientId = decoded.slice(0, separator);
        clientSecret = decoded.slice(separator + 1);
      }
    } catch {
      return json({ error: "invalid_client" }, 401);
    }
  }

  const token = params.token?.trim() ?? "";
  if (!clientId || !clientSecret || !token) {
    return json({ error: "invalid_request" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: client, error: clientError } = await supabase
      .from("oauth_clients")
      .select("id, client_secret_hash, is_active")
      .eq("client_id", clientId)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client || (await sha256Hex(clientSecret)) !== client.client_secret_hash) {
      return json({ error: "invalid_client" }, 401);
    }

    const tokenHash = await sha256Hex(token);
    const now = new Date().toISOString();

    // Look in both token tables; revoking a refresh token ends the whole connection.
    const { data: accessToken } = await supabase
      .from("oauth_access_tokens")
      .select("id, grant_id")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    const { data: refreshToken } = await supabase
      .from("oauth_refresh_tokens")
      .select("id, grant_id")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    const grantId = (refreshToken?.grant_id ?? accessToken?.grant_id) as string | undefined;
    if (grantId) {
      const { data: grant } = await supabase
        .from("oauth_access_grants")
        .select("id, client_uuid")
        .eq("id", grantId)
        .maybeSingle();

      if (grant?.client_uuid === client.id) {
        if (refreshToken) {
          await supabase
            .from("oauth_access_grants")
            .update({ revoked_at: now })
            .eq("id", grantId)
            .is("revoked_at", null);
          await supabase
            .from("oauth_refresh_tokens")
            .update({ revoked_at: now })
            .eq("grant_id", grantId)
            .is("revoked_at", null);
          await supabase
            .from("oauth_access_tokens")
            .update({ revoked_at: now })
            .eq("grant_id", grantId)
            .is("revoked_at", null);
        } else if (accessToken) {
          await supabase
            .from("oauth_access_tokens")
            .update({ revoked_at: now })
            .eq("id", accessToken.id)
            .is("revoked_at", null);
        }
      }
    }

    // RFC 7009: always answer 200, even for unknown tokens.
    return json({ revoked: true });
  } catch (error) {
    console.error("oauth-revoke failed", { message: (error as Error).message });
    return json({ error: "server_error" }, 500);
  }
});
