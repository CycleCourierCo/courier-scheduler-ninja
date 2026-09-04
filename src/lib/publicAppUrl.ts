/** Public URL for unauthenticated pages (e.g. partner uploads, repair offers). */
export function getPublicAppUrl(): string {
  const configured = (import.meta as any).env?.VITE_PUBLIC_APP_URL;
  if (configured) return String(configured).replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://booking.cyclecourierco.com";
}
