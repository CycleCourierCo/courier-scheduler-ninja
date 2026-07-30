/**
 * Shared helpers for the InspectaBike (bike-checker-pro) integration.
 *
 * InspectaBike is a separate Supabase project. It owns the bike's permanent
 * condition/fault/service record; this portal owns pricing, customer approval
 * and invoicing. All traffic between the two is HMAC-signed or API-key verified.
 */

export const EXTERNAL_PROVIDER = "inspectabike";

/** Placeholder actor for rows created by the integration rather than a portal user. */
export const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

export function getBaseUrl(): string | null {
  const raw = Deno.env.get("INSPECTABIKE_BASE_URL");
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function getApiKey(): string | null {
  return Deno.env.get("INSPECTABIKE_API_KEY") ?? null;
}

export function getSyncSecret(): string | null {
  return Deno.env.get("INSPECTABIKE_SYNC_SECRET") ?? null;
}

const encoder = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hex-encoded HMAC-SHA256 of the raw request body. */
export async function signPayload(rawBody: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  return toHex(sig);
}

/** Constant-time-ish comparison of two hex signatures. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySignature(
  rawBody: string,
  headerValue: string | null,
  secret: string,
): Promise<boolean> {
  if (!headerValue) return false;
  const provided = headerValue.replace(/^sha256=/, "").trim().toLowerCase();
  const expected = await signPayload(rawBody, secret);
  return safeEqual(provided, expected);
}

/** price = max(min_charge, ceil((minutes * rate / 60) / 5) * 5) — mirrors src/lib/labourPricing.ts */
export function calculateLabourPrice(
  minutes: number,
  hourlyRate: number,
  minCharge: number,
): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return minCharge;
  const raw = (minutes * hourlyRate) / 60;
  const rounded = Math.ceil(raw / 5) * 5;
  return Math.max(minCharge, rounded);
}

export interface WorkshopRates {
  hourlyRate: number;
  minCharge: number;
}

export async function loadWorkshopRates(supabase: any): Promise<WorkshopRates> {
  const { data } = await supabase
    .from("workshop_settings")
    .select("hourly_rate_gbp,min_charge_gbp")
    .eq("id", 1)
    .maybeSingle();
  return {
    hourlyRate: Number(data?.hourly_rate_gbp ?? 75),
    minCharge: Number(data?.min_charge_gbp ?? 15),
  };
}

/** POST JSON to an InspectaBike edge function using the shared API key. */
export async function callInspectaBike(
  fn: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const base = getBaseUrl();
  const apiKey = getApiKey();
  if (!base || !apiKey) {
    return { ok: false, status: 500, data: null, error: "InspectaBike integration is not configured" };
  }

  const res = await fetch(`${base}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    console.error(`InspectaBike ${fn} failed [${res.status}]`);
    return { ok: false, status: res.status, data: parsed, error: `InspectaBike returned ${res.status}` };
  }
  return { ok: true, status: res.status, data: parsed };
}
