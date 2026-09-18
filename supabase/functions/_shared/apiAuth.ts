// Resolves the account behind a public API request. Supports both the long-standing
// X-API-Key header and OAuth bearer tokens issued to partner apps.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface ApiCaller {
  userId?: string;
  authType?: "api_key" | "oauth";
  error?: "MISSING_API_KEY" | "INVALID_API_KEY" | "INVALID_TOKEN";
}

export async function resolveApiCaller(
  req: Request,
  supabase: SupabaseClient,
): Promise<ApiCaller> {
  const apiKey = req.headers.get("X-API-Key");
  if (apiKey) {
    const { data, error } = await supabase.rpc("verify_api_key", { api_key: apiKey });
    if (error || !data) return { error: "INVALID_API_KEY" };
    return { userId: data as string, authType: "api_key" };
  }

  const authHeader = req.headers.get("Authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (!token) return { error: "INVALID_TOKEN" };
    const { data, error } = await supabase.rpc("verify_oauth_token", { access_token: token });
    if (error || !data) return { error: "INVALID_TOKEN" };
    return { userId: data as string, authType: "oauth" };
  }

  return { error: "MISSING_API_KEY" };
}

export function apiAuthErrorResponse(caller: ApiCaller, corsHeaders: Record<string, string>) {
  const message = caller.error === "MISSING_API_KEY"
    ? "API key or access token is required"
    : caller.error === "INVALID_TOKEN"
      ? "Invalid or expired access token"
      : "Invalid API key";

  return new Response(
    JSON.stringify({ error: message, code: caller.error }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
