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

// --- Outgoing email pacing ---------------------------------------------------
// Resend accepts roughly 2 requests per second. Bursty fan-outs (the daily
// customer update run) used to blow straight past that and lose emails, so every
// send is funnelled through one queue with a minimum gap between calls.
const RESEND_MIN_GAP_MS = 500;
let resendQueue: Promise<unknown> = Promise.resolve();
let lastResendAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs `fn` after waiting its turn in the shared send queue. */
function paced<T>(fn: () => Promise<T>): Promise<T> {
  const run = resendQueue.then(async () => {
    const wait = lastResendAt + RESEND_MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastResendAt = Date.now();
    return fn();
  });
  // Keep the chain alive even when a send throws.
  resendQueue = run.then(() => {}, () => {});
  return run;
}

function isRateLimited(value: unknown): boolean {
  const any = value as any;
  const name = String(any?.name ?? "");
  const message = String(any?.message ?? "");
  const status = Number(any?.statusCode ?? any?.status ?? 0);
  return status === 429 || /rate_limit|rate limit|too many requests/i.test(`${name} ${message}`);
}

/**
 * Wraps a Resend client so every `emails.send(...)` call is paced, retried on
 * rate limiting, timed and counted.
 * Only metrics are recorded — never recipients, subjects or bodies.
 */
export function trackResend<T extends { emails: { send: (...args: any[]) => Promise<any> } }>(
  client: T,
  operation = "send email",
): T {
  const originalSend = client.emails.send.bind(client.emails);
  client.emails.send = async (...args: any[]) => {
    const started = Date.now();
    const backoffs = [1000, 2000, 4000];
    let attempt = 0;

    for (;;) {
      try {
        const result = await paced(() => originalSend(...args));
        const error = result?.error;
        if (error && isRateLimited(error) && attempt < backoffs.length) {
          await sleep(backoffs[attempt++]);
          continue;
        }
        logIntegrationCall({
          provider: "resend",
          operation,
          direction: "outbound",
          statusCode: error ? null : 200,
          success: !error,
          durationMs: Date.now() - started,
          errorLabel: error
            ? (error?.name ?? "resend_error")
            : attempt > 0
              ? `sent_after_${attempt}_retries`
              : null,
        });
        return result;
      } catch (error) {
        if (isRateLimited(error) && attempt < backoffs.length) {
          await sleep(backoffs[attempt++]);
          continue;
        }
        logIntegrationCall({
          provider: "resend",
          operation,
          direction: "outbound",
          success: false,
          durationMs: Date.now() - started,
          errorLabel: error instanceof Error ? error.name : "resend_error",
        });
        throw error;
      }
    }
  };
  return client;
}

