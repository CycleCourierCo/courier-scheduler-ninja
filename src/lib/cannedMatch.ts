import type { CsCannedResponse } from "@/services/cannedResponseService";

const normalise = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Score saved replies against the customer's latest message by keyword/phrase hits.
 * Purely local — no AI call.
 */
export function suggestCannedResponses(
  text: string | null | undefined,
  responses: CsCannedResponse[],
  limit = 3,
): CsCannedResponse[] {
  const haystack = normalise(text || "");
  if (haystack.length < 3) return [];

  const scored = responses
    .filter((r) => r.is_active && (r.keywords?.length ?? 0) > 0)
    .map((r) => {
      let score = 0;
      for (const raw of r.keywords) {
        const kw = normalise(raw || "");
        if (!kw) continue;
        if (!haystack.includes(kw)) continue;
        // Longer / multi-word phrases are stronger signals.
        score += 1 + kw.split(" ").length;
      }
      return { r, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.r.sort_order - b.r.sort_order);

  return scored.slice(0, limit).map((s) => s.r);
}

export interface CannedFillContext {
  customerName?: string | null;
  ticketRef?: string | null;
  trackingNumber?: string | null;
  orderStatus?: string | null;
  myName?: string | null;
}

const prettyStatus = (status?: string | null) =>
  status ? status.replace(/_/g, " ").toLowerCase() : "";

/** Replace {{placeholders}}; anything unknown becomes blank rather than raw braces. */
export function fillCannedBody(body: string, ctx: CannedFillContext): string {
  const map: Record<string, string> = {
    customer_name: (ctx.customerName || "there").trim(),
    ticket_ref: (ctx.ticketRef || "").trim(),
    tracking_number: (ctx.trackingNumber || "").trim(),
    order_status: prettyStatus(ctx.orderStatus),
    my_name: (ctx.myName || "").trim(),
  };
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => map[key.toLowerCase()] ?? "");
}
