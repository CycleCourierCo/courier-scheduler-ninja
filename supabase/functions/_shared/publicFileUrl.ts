// Rewrites storage URLs from the raw Supabase project host onto the public API
// domain (a Supabase custom domain), leaving path/token/query untouched.
const DEFAULT_PUBLIC_API_URL = "https://api.cyclecourierco.com";

export const publicApiOrigin = (): string => {
  const configured = Deno.env.get("PUBLIC_API_URL") || DEFAULT_PUBLIC_API_URL;
  try {
    return new URL(configured).origin;
  } catch {
    return DEFAULT_PUBLIC_API_URL;
  }
};

export const toPublicFileUrl = <T extends string | null | undefined>(url: T): T => {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const projectOrigin = new URL(Deno.env.get("SUPABASE_URL") || "").origin;
    if (parsed.origin !== projectOrigin) return url;
    const target = new URL(publicApiOrigin());
    parsed.protocol = target.protocol;
    parsed.host = target.host;
    return parsed.toString() as T;
  } catch {
    return url;
  }
};
