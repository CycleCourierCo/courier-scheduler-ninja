// Marks the retail Shopify order as fulfilled with our tracking link.
export function retailTrackingUrl(trackingNumber: string): string {
  return `https://cyclecourierco.com/pages/track?ref=${encodeURIComponent(trackingNumber)}`;
}

// Short-lived Admin API token via the client credentials grant (cached until near expiry).
let cached: { token: string; expiresAt: number } | null = null;
async function getAccessToken(domain: string): Promise<string | null> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const clientId = Deno.env.get("SHOPIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SHOPIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) {
    console.error("Shopify token request failed:", res.status);
    return null;
  }
  const data = await res.json();
  cached = { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return cached.token;
}

export async function fulfilShopifyOrder(shopifyOrderId: string, trackingNumber: string): Promise<string> {
  const domain = Deno.env.get("SHOPIFY_STORE_DOMAIN")?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!domain) return "skipped: SHOPIFY_STORE_DOMAIN not configured";
  const token = await getAccessToken(domain);
  if (!token) return "skipped: could not get Shopify access token";
  const headers = { "X-Shopify-Access-Token": token, "Content-Type": "application/json" };
  const foRes = await fetch(`https://${domain}/admin/api/2024-10/orders/${shopifyOrderId}/fulfillment_orders.json`, { headers });
  if (!foRes.ok) return `failed: fulfillment_orders ${foRes.status}`;
  const fos = ((await foRes.json()).fulfillment_orders || []).filter(
    (fo: any) => fo.status === "open" || fo.status === "in_progress",
  );
  if (fos.length === 0) return "skipped: already fulfilled";
  const res = await fetch(`https://${domain}/admin/api/2024-10/fulfillments.json`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fulfillment: {
        notify_customer: false,
        tracking_info: { number: trackingNumber, company: "Cycle Courier Co.", url: retailTrackingUrl(trackingNumber) },
        line_items_by_fulfillment_order: fos.map((fo: any) => ({ fulfillment_order_id: fo.id })),
      },
    }),
  });
  return res.ok ? "fulfilled" : `failed: fulfillments ${res.status}`;
}
