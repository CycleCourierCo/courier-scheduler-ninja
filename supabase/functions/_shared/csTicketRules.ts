// Ticket close/reopen rules. No imports so Vitest tests the same code.
const HOUR = 3600_000;
export const WA_WINDOW_MS = 24 * HOUR;
export const REOPEN_WINDOW_MS = 7 * 24 * HOUR;

/** WhatsApp allows free text only within 24h of the customer's last message. */
export function inWhatsAppWindow(lastInboundAt: string | null | undefined, now = Date.now()): boolean {
  if (!lastInboundAt) return false;
  return now - new Date(lastInboundAt).getTime() < WA_WINDOW_MS;
}

/** A customer reply reopens a closed ticket only within 7 days of closing; otherwise a new ticket starts. */
export function canReopenClosed(closedAt: string | null | undefined, now = Date.now()): boolean {
  if (!closedAt) return true;
  return now - new Date(closedAt).getTime() <= REOPEN_WINDOW_MS;
}

export function whatsappClosingText(ref: string | null | undefined): string {
  return `Thanks for chatting with Cycle Courier Co. We've marked this conversation as resolved${ref ? ` (ref ${ref})` : ''}. Just reply here if you need anything else.`;
}
