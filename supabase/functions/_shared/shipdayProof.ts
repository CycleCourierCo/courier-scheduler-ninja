// Pulls driver proof (photos + signature) for a Shipday job straight from the
// Shipday API, for when the webhook arrives without them.

export interface ShipdayProof {
  podUrls: string[];
  signatureUrl: string | null;
}

const isImageUrl = (v: unknown): v is string =>
  typeof v === "string" && /^https?:\/\//i.test(v) &&
  (/\.(jpe?g|png|webp|heic)(\?|$)/i.test(v) || /order\.signature|pod|proof/i.test(v));

/** Walk the response; URLs under a key mentioning "signature" are signatures. */
export const extractProof = (body: unknown): ShipdayProof => {
  const pods = new Set<string>();
  let signatureUrl: string | null = null;
  const walk = (node: unknown, keyPath: string) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, keyPath)); return; }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) walk(v, `${keyPath}.${k}`.toLowerCase());
      return;
    }
    if (!isImageUrl(node)) return;
    if (/signature/.test(keyPath.split(".").pop() || "") || /signatures?(\.|$)/.test(keyPath)) {
      if (!signatureUrl) signatureUrl = node;
    } else if (/(pod|proof|image|photo)/.test(keyPath)) {
      pods.add(node);
    }
  };
  walk(body, "");
  return { podUrls: [...pods], signatureUrl };
};

export const fetchShipdayProof = async (apiKey: string, shipdayId: string): Promise<ShipdayProof | null> => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://api.shipday.com/orders/${shipdayId}`, {
      headers: { Authorization: `Basic ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const j = await res.json();
    return extractProof(Array.isArray(j) ? j[0] : j);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
};

/** Re-reads the order and stores proof on the leg's completion event. Returns true if saved. */
// deno-lint-ignore no-explicit-any
export const saveShipdayProof = async (supabase: any, orderId: string, shipdayId: string, leg: "pickup" | "delivery", proof: ShipdayProof): Promise<boolean> => {
  if (proof.podUrls.length === 0 && !proof.signatureUrl) return false;
  const { data: order } = await supabase.from("orders").select("tracking_events").eq("id", orderId).single();
  if (!order) return false;
  const te = order.tracking_events || {};
  const sd = te.shipday || { updates: [] };
  const updates = Array.isArray(sd.updates) ? sd.updates : [];
  const hasProof = updates.some((u: any) => u?.leg === leg && ((u.podUrls?.length ?? 0) > 0 || u.signatureUrl));
  if (hasProof) return false;
  let filled = false;
  for (let i = updates.length - 1; i >= 0; i--) {
    const u = updates[i];
    if (u?.event === "ORDER_COMPLETED" && (u.leg === leg || String(u.orderId) === shipdayId)) {
      u.podUrls = proof.podUrls;
      u.signatureUrl = proof.signatureUrl;
      filled = true;
      break;
    }
  }
  if (!filled) {
    updates.push({
      event: "ORDER_POD_UPLOAD", leg, orderId: shipdayId, timestamp: new Date().toISOString(),
      description: leg === "pickup" ? "Proof of collection retrieved" : "Proof of delivery retrieved",
      podUrls: proof.podUrls, signatureUrl: proof.signatureUrl,
    });
  }
  sd.updates = updates;
  te.shipday = sd;
  const { error } = await supabase.from("orders").update({ tracking_events: te }).eq("id", orderId);
  return !error;
};
