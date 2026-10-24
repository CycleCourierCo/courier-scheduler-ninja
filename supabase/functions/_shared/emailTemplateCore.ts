/**
 * Pure helpers for admin-editable email templates (Email Centre).
 * No Deno/network imports so the rules can be unit tested with vitest.
 */

export interface TemplateBlocks {
  headline?: string;
  paragraphs?: string[];
  buttonLabel?: string;
  buttonUrl?: string;
  closing?: string;
}

export interface TemplateRow {
  key: string;
  enabled: boolean;
  locked: boolean;
  is_custom: boolean;
  subject: string | null;
  preheader: string | null;
  blocks: TemplateBlocks | null;
  recipients: string[];
  cc: string[];
  bcc: string[];
}

/** Variables admins may use. Anything else is left out, never evaluated. */
export const TEMPLATE_VARIABLES = [
  "customer_name",
  "tracking_number",
  "sender_name",
  "receiver_name",
  "bike",
  "collection_date",
  "delivery_date",
  "tracking_link",
] as const;
export type TemplateVar = (typeof TEMPLATE_VARIABLES)[number];
export type TemplateVars = Partial<Record<TemplateVar, string>>;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Replace {{var}} tags. html=true escapes values; unknown tags become empty. */
export function fillVars(text: string, vars: TemplateVars, html: boolean): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, name: string) => {
    if (!(TEMPLATE_VARIABLES as readonly string[]).includes(name)) return "";
    const v = vars[name as TemplateVar] ?? "";
    return html ? esc(v) : v;
  });
}

/** Locked emails (money, legal, secret links) can't be switched off or re-timed. */
export function isSendAllowed(t: Pick<TemplateRow, "enabled" | "locked"> | null): boolean {
  if (!t) return true;
  return t.locked ? true : t.enabled;
}

const isEmail = (s: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
export const cleanAddresses = (list: unknown): string[] =>
  Array.isArray(list) ? list.map((s) => String(s).trim()).filter(isEmail).slice(0, 10) : [];

/** Only http(s) links are allowed in admin buttons. */
export const safeUrl = (u: string) => (/^https:\/\/[^\s"'<>]+$/i.test(u) ? u : "");

/** Has the admin replaced the built-in wording? */
export const hasCustomBody = (b: TemplateBlocks | null | undefined) =>
  !!b && (!!b.headline?.trim() || (b.paragraphs || []).some((p) => p.trim()));
