// Marks the retail Shopify order as fulfilled with our tracking link.
export function retailTrackingUrl(trackingNumber: string): string {
  return `https://cyclecourierco.com/pages/track?ref=${encodeURIComponent(trackingNumber)}`;
}

export async function fulfilShopifyOrder(shopifyOrderId: string, trackingNumber: string): Promise<string> {
  const domain = Deno.env.get("SHOPIFY_STORE_DOMAIN")?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const token = Deno.env.get("SHOPIFY_ADMIN_ACCESS_TOKEN");
  if (!domain || !token) return "skipped: Shopify admin credentials not configured";
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
