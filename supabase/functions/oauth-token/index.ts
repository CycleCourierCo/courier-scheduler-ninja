// Token endpoint for the partner OAuth 2.1 flow.
// Supports grant_type=authorization_code (with PKCE) and grant_type=refresh_token.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import {
  sha256Hex,
  randomToken,
  verifyPkce,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
} from "../_shared/oauthTokens.ts";

// Coarse in-memory throttle: blunt the obvious brute-force attempts without
// pretending to be a distributed rate limiter.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 30;

function throttled(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

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

  // Accept both form-encoded (the OAuth default) and JSON bodies.
  let params: Record<string, string> = {};
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const parsed = await req.json();
      for (const [key, value] of Object.entries(parsed ?? {})) {
        if (typeof value === "string") params[key] = value;
      }
    } else {
      const form = new URLSearchParams(await req.text());
      params = Object.fromEntries(form.entries());
    }
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  // Client credentials may arrive via HTTP Basic or in the body.
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

  if (!clientId || !clientSecret) {
    return json({ error: "invalid_client" }, 401);
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (throttled(`${clientId}:${clientIp}`)) {
    return json({ error: "slow_down" }, 429);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: client, error: clientError } = await supabase
      .from("oauth_clients")
      .select("id, client_secret_hash, redirect_uris, is_active")
      .eq("client_id", clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client || client.is_active !== true) {
      return json({ error: "invalid_client" }, 401);
    }
    if ((await sha256Hex(clientSecret)) !== client.client_secret_hash) {
      return json({ error: "invalid_client" }, 401);
    }

    const issueTokens = async (grantId: string) => {
      const accessToken = randomToken("ccat");
      const refreshToken = randomToken("ccrt");

      const { error: accessError } = await supabase.from("oauth_access_tokens").insert({
        grant_id: grantId,
        token_hash: await sha256Hex(accessToken),
        expires_at: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
      });
      if (accessError) throw accessError;

      const { error: refreshError } = await supabase.from("oauth_refresh_tokens").insert({
        grant_id: grantId,
        token_hash: await sha256Hex(refreshToken),
        expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86_400_000).toISOString(),
      });
      if (refreshError) throw refreshError;

      return json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        refresh_token: refreshToken,
        scope: "api",
      });
    };

    if (params.grant_type === "authorization_code") {
      const code = params.code?.trim() ?? "";
      const verifier = params.code_verifier?.trim() ?? "";
      const redirectUri = params.redirect_uri?.trim() ?? "";
      if (!code || !verifier || !redirectUri) {
        return json({ error: "invalid_request" }, 400);
      }

      const { data: codeRow, error: codeError } = await supabase
        .from("oauth_authorization_codes")
        .select("id, client_uuid, user_id, redirect_uri, code_challenge, code_challenge_method, expires_at, used_at")
        .eq("code_hash", await sha256Hex(code))
        .maybeSingle();

      if (codeError) throw codeError;
      if (!codeRow || codeRow.client_uuid !== client.id) {
        return json({ error: "invalid_grant" }, 400);
      }
      if (codeRow.used_at || new Date(codeRow.expires_at).getTime() < Date.now()) {
        return json({ error: "invalid_grant" }, 400);
      }
      if (codeRow.redirect_uri !== redirectUri) {
        return json({ error: "invalid_grant" }, 400);
      }
      if (!(await verifyPkce(verifier, codeRow.code_challenge, codeRow.code_challenge_method))) {
        return json({ error: "invalid_grant" }, 400);
      }

      // Burn the code first so a replay cannot mint a second token pair.
      const { data: burned, error: burnError } = await supabase
        .from("oauth_authorization_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", codeRow.id)
        .is("used_at", null)
        .select("id");
      if (burnError) throw burnError;
      if (!burned || burned.length === 0) {
        return json({ error: "invalid_grant" }, 400);
      }

      const { data: grant, error: grantError } = await supabase
        .from("oauth_access_grants")
        .select("id")
        .eq("client_uuid", client.id)
        .eq("user_id", codeRow.user_id)
        .is("revoked_at", null)
        .maybeSingle();
      if (grantError) throw grantError;
      if (!grant) {
        return json({ error: "invalid_grant" }, 400);
      }

      return await issueTokens(grant.id);
    }

    if (params.grant_type === "refresh_token") {
      const refreshToken = params.refresh_token?.trim() ?? "";
      if (!refreshToken) {
        return json({ error: "invalid_request" }, 400);
      }

      const { data: tokenRow, error: tokenError } = await supabase
        .from("oauth_refresh_tokens")
        .select("id, grant_id, expires_at, rotated_at, revoked_at")
        .eq("token_hash", await sha256Hex(refreshToken))
        .maybeSingle();
      if (tokenError) throw tokenError;
      if (!tokenRow) {
        return json({ error: "invalid_grant" }, 400);
      }

      const { data: grant, error: grantError } = await supabase
        .from("oauth_access_grants")
        .select("id, client_uuid, revoked_at")
        .eq("id", tokenRow.grant_id)
        .maybeSingle();
      if (grantError) throw grantError;
      if (!grant || grant.client_uuid !== client.id || grant.revoked_at) {
        return json({ error: "invalid_grant" }, 400);
      }

      // Replay of an already-rotated token means the token leaked: kill the grant.
      if (tokenRow.rotated_at || tokenRow.revoked_at) {
        await supabase.rpc("cleanup_expired_oauth");
        await supabase
          .from("oauth_access_grants")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", grant.id);
        await supabase
          .from("oauth_refresh_tokens")
          .update({ revoked_at: new Date().toISOString() })
          .eq("grant_id", grant.id)
          .is("revoked_at", null);
        await supabase
          .from("oauth_access_tokens")
          .update({ revoked_at: new Date().toISOString() })
          .eq("grant_id", grant.id)
          .is("revoked_at", null);
        return json({ error: "invalid_grant" }, 400);
      }

      if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
        return json({ error: "invalid_grant" }, 400);
      }

      const { data: rotated, error: rotateError } = await supabase
        .from("oauth_refresh_tokens")
        .update({ rotated_at: new Date().toISOString() })
        .eq("id", tokenRow.id)
        .is("rotated_at", null)
        .select("id");
      if (rotateError) throw rotateError;
      if (!rotated || rotated.length === 0) {
        return json({ error: "invalid_grant" }, 400);
      }

      return await issueTokens(grant.id);
    }

    return json({ error: "unsupported_grant_type" }, 400);
  } catch (error) {
    console.error("oauth-token failed", { message: (error as Error).message });
    return json({ error: "server_error" }, 500);
  }
});
