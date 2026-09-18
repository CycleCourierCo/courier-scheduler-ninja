// Issues a single-use authorization code once the signed-in customer approves a
// partner app on the /oauth/authorize consent screen.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { sha256Hex, randomToken, AUTH_CODE_TTL_SECONDS } from "../_shared/oauthTokens.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const auth = await requireAuth(req);
  if (!auth.success) {
    return json({ error: "login_required" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  const clientId = typeof body.client_id === "string" ? body.client_id.trim() : "";
  const redirectUri = typeof body.redirect_uri === "string" ? body.redirect_uri.trim() : "";
  const codeChallenge = typeof body.code_challenge === "string" ? body.code_challenge.trim() : "";
  const method = body.code_challenge_method === "plain" ? "plain" : "S256";

  if (!clientId || !redirectUri || !codeChallenge) {
    return json({ error: "invalid_request" }, 400);
  }
  if (codeChallenge.length < 32 || codeChallenge.length > 200) {
    return json({ error: "invalid_request" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: client, error: clientError } = await supabase
      .from("oauth_clients")
      .select("id, redirect_uris, is_active")
      .eq("client_id", clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client || client.is_active !== true) {
      return json({ error: "unauthorized_client" }, 400);
    }
    if (!(client.redirect_uris as string[]).includes(redirectUri)) {
      return json({ error: "invalid_redirect_uri" }, 400);
    }

    // Reuse an existing approval where possible so repeat connects don't pile up.
    const { data: existingGrant } = await supabase
      .from("oauth_access_grants")
      .select("id")
      .eq("client_uuid", client.id)
      .eq("user_id", auth.userId!)
      .is("revoked_at", null)
      .maybeSingle();

    let grantId = existingGrant?.id as string | undefined;
    if (!grantId) {
      const { data: inserted, error: grantError } = await supabase
        .from("oauth_access_grants")
        .insert({ client_uuid: client.id, user_id: auth.userId!, scope: "api" })
        .select("id")
        .single();
      if (grantError) throw grantError;
      grantId = inserted.id;
    }

    const code = randomToken("ccode");
    const { error: codeError } = await supabase.from("oauth_authorization_codes").insert({
      code_hash: await sha256Hex(code),
      client_uuid: client.id,
      user_id: auth.userId!,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: method,
      scope: "api",
      expires_at: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000).toISOString(),
    });
    if (codeError) throw codeError;

    return json({ code, grant_id: grantId });
  } catch (error) {
    console.error("oauth-authorize failed", { message: (error as Error).message });
    return json({ error: "server_error" }, 500);
  }
});
