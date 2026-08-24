// Rewrites storage URLs from the raw Supabase project host onto the public API
// domain (a Supabase custom domain), leaving path/token/query untouched.
const DEFAULT_PUBLIC_API_URL = "https://api.cyclecourierco.com";

const publicApiOrigin = (): string => {
  const configured =
    (import.meta.env.VITE_PUBLIC_API_URL as string | undefined) || DEFAULT_PUBLIC_API_URL;
  try {
    return new URL(configured).origin;
  } catch {
    return DEFAULT_PUBLIC_API_URL;
  }
};

/** Origin to use when building storage URLs by hand. */
export const publicFileOrigin = publicApiOrigin;

export function toPublicFileUrl<T extends string | null | undefined>(url: T): T {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const projectOrigin = new URL(import.meta.env.VITE_SUPABASE_URL as string).origin;
    if (parsed.origin !== projectOrigin) return url;
    const target = new URL(publicApiOrigin());
    parsed.protocol = target.protocol;
    parsed.host = target.host;
    return parsed.toString() as T;
  } catch {
    return url;
  }
}

export const toPublicFileUrls = (urls: (string | null | undefined)[]): string[] =>
  urls.map((u) => toPublicFileUrl(u)).filter((u): u is string => !!u);
