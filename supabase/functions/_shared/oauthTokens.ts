// Shared helpers for the partner OAuth 2.1 flow ("Connect with Cycle Courier").
// Tokens are opaque random strings; only their SHA-256 hashes are stored.

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomToken(prefix: string, bytes = 32): string {
  const raw = new Uint8Array(bytes);
  crypto.getRandomValues(raw);
  const hex = Array.from(raw)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}_${hex}`;
}

/** base64url without padding, per RFC 7636 */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Verify a PKCE code_verifier against the stored challenge. */
export async function verifyPkce(
  verifier: string,
  challenge: string,
  method: string,
): Promise<boolean> {
  if (method === "plain") return verifier === challenge;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest)) === challenge;
}

export const ACCESS_TOKEN_TTL_SECONDS = 3600;
export const REFRESH_TOKEN_TTL_DAYS = 180;
export const AUTH_CODE_TTL_SECONDS = 60;
