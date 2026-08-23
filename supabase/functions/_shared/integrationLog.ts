// Integration call analytics.
//
// Records METRICS ONLY for traffic between this system and third-party services:
// provider, a short operation label, HTTP status, success, duration and a short
// error label. Never log request/response bodies, customer data or secrets here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

export type IntegrationProvider =
  | "shipday"
  | "whatsapp"
  | "quickbooks"
  | "resend"
  | "shopify"
  | "inspectabike"
  | "geoapify"
  | "dvla"
  | "fuel"
  | "google_maps"
  | "other";

export type IntegrationDirection = "outbound" | "inbound";

export interface IntegrationLogEntry {
  provider: IntegrationProvider;
  operation: string;
  direction?: IntegrationDirection;
  statusCode?: number | null;
  success: boolean;
  durationMs?: number | null;
  /** Short, non-sensitive label such as "timeout" or "invalid_token". Never a payload. */
  errorLabel?: string | null;
}

function client() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Trim an error label to something short and safe to store. */
function safeLabel(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = value instanceof Error ? value.name || "error" : String(value);
  return text.replace(/\s+/g, " ").trim().slice(0, 120) || null;
}

async function insertLog(entry: IntegrationLogEntry): Promise<void> {
  const supabase = client();
  if (!supabase) return;
  try {
    await supabase.from("integration_call_logs").insert({
      provider: entry.provider,
      direction: entry.direction ?? "outbound",
      operation: entry.operation.slice(0, 80),
      status_code: entry.statusCode ?? null,
      success: entry.success,
      duration_ms:
        entry.durationMs === null || entry.durationMs === undefined
          ? null
          : Math.max(0, Math.round(entry.durationMs)),
      error_label: safeLabel(entry.errorLabel),
    });
  } catch (_err) {
    // Analytics must never break an integration.
  }
}

/**
 * Fire-and-forget metric write. Safe to call from any edge function.
 */
export function logIntegrationCall(entry: IntegrationLogEntry): void {
  const promise = insertLog(entry);
  try {
    // @ts-ignore EdgeRuntime is provided by the Supabase runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(promise);
      return;
    }
  } catch (_err) {
    // fall through
  }
  promise.catch(() => {});
}

/** Convenience wrapper for recording an inbound webhook hit. */
export function logInboundWebhook(
  provider: IntegrationProvider,
  operation: string,
  opts: { success: boolean; statusCode?: number; errorLabel?: string | null } = {
    success: true,
  },
): void {
  logIntegrationCall({
    provider,
    operation,
    direction: "inbound",
    success: opts.success,
    statusCode: opts.statusCode ?? (opts.success ? 200 : 401),
    errorLabel: opts.errorLabel ?? null,
  });
}

/**
 * Drop-in replacement for `fetch` that times the call and records the outcome.
 * The response is returned untouched (body not read), so callers behave exactly
 * as they did with plain `fetch`.
 */
export async function trackedFetch(
  provider: IntegrationProvider,
  operation: string,
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const started = Date.now();
  try {
    const response = await fetch(input, init);
    logIntegrationCall({
      provider,
      operation,
      direction: "outbound",
      statusCode: response.status,
      success: response.ok,
      durationMs: Date.now() - started,
      errorLabel: response.ok ? null : `http_${response.status}`,
    });
    return response;
  } catch (error) {
    logIntegrationCall({
      provider,
      operation,
      direction: "outbound",
      statusCode: null,
      success: false,
      durationMs: Date.now() - started,
      errorLabel: error instanceof Error ? error.name : "network_error",
    });
    throw error;
  }
}
