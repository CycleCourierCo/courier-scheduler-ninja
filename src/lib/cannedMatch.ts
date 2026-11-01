import type { CsCannedResponse } from "@/services/cannedResponseService";
import { scoreResponses } from "../../supabase/functions/_shared/cannedConfidence";

/** Saved replies scored against the customer's latest message (same rule the server auto-reply uses). */
export function scoreCannedResponses(text: string | null | undefined, responses: CsCannedResponse[]) {
  return scoreResponses(text, responses);
}

export function suggestCannedResponses(
  text: string | null | undefined,
  responses: CsCannedResponse[],
  limit = 3,
): CsCannedResponse[] {
  return scoreResponses(text, responses).slice(0, limit).map((s) => s.response);
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
