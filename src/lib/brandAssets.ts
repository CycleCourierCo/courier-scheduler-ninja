// Brand assets are served by Lovable hosting on every domain the app runs on
// (booking.cyclecourierco.com, previews, published site). Resolve against the
// current site so a password-protected or different domain can never block them.
const FALLBACK_ORIGIN = "https://booking.cyclecourierco.com";

export const publicBrandAssetUrl = (path: string) => {
  const origin = typeof window !== "undefined" && window.location?.origin?.startsWith("http")
    ? window.location.origin
    : FALLBACK_ORIGIN;
  return new URL(path, origin).href;
};
