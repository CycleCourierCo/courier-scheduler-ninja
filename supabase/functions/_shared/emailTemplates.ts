import { emailShell, emailUI } from "./emailLayout.ts";
import {
  fillVars, hasCustomBody, safeUrl, TemplateBlocks, TemplateRow, TemplateVars,
} from "./emailTemplateCore.ts";

export * from "./emailTemplateCore.ts";

const cache = new Map<string, { at: number; row: TemplateRow | null }>();

/** Load a template by key (cached 60s). Returns null on any error. */
export async function loadTemplate(admin: any, key: string): Promise<TemplateRow | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.row;
  try {
    const { data } = await admin
      .from("email_templates")
      .select("key, enabled, locked, is_custom, subject, preheader, blocks, recipients, cc, bcc, wording_mode")
      .eq("key", key)
      .maybeSingle();
    cache.set(key, { at: Date.now(), row: data ?? null });
    return data ?? null;
  } catch {
    return null;
  }
}

const fmtDate = (d?: string | null) => {
  if (!d) return "";
  const x = new Date(d);
  return isNaN(x.getTime())
    ? ""
    : x.toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" });
};

/** Build the variable set from an order snapshot. */
export function varsFromOrder(order: any, recipientName?: string): TemplateVars {
  const bikes = Array.isArray(order?.bikes) ? order.bikes : [];
  const bike = bikes.length
    ? bikes.map((b: any) => [b.brand, b.model].filter(Boolean).join(" ")).filter(Boolean).join(", ")
    : [order?.bike_brand, order?.bike_model].filter(Boolean).join(" ");
  const tn = order?.tracking_number || "";
  return {
    customer_name: recipientName || "",
    tracking_number: tn,
    sender_name: order?.sender?.name || "",
    receiver_name: order?.receiver?.name || "",
    bike: bike || "your bike",
    collection_date: fmtDate(order?.scheduled_pickup_date),
    delivery_date: fmtDate(order?.scheduled_delivery_date),
    tracking_link: tn ? `https://cyclecourierco.com/pages/track?ref=${encodeURIComponent(tn)}` : "",
  };
}

/** Render admin blocks into a full branded email. */
export function renderBlocks(
  blocks: TemplateBlocks,
  vars: TemplateVars,
  opts: { subject: string; preheader?: string | null; extraHtml?: string },
): { html: string; text: string } {
  const h = (s: string) => fillVars(s, vars, true);
  const t = (s: string) => fillVars(s, vars, false);
  const paras = (blocks.paragraphs || []).filter((p) => p.trim());
  const url = safeUrl(t(blocks.buttonUrl || ""));
  let body = "";
  if (blocks.headline) body += emailUI.heading(h(blocks.headline));
  for (const p of paras) body += emailUI.paragraph(h(p).replace(/\n/g, "<br>"));
  if (blocks.buttonLabel && url) body += emailUI.button(url, h(blocks.buttonLabel));
  if (opts.extraHtml) body += opts.extraHtml;
  if (blocks.closing) body += emailUI.paragraph(h(blocks.closing).replace(/\n/g, "<br>"));
  const html = emailShell(body, {
    subject: opts.subject,
    preheader: opts.preheader ? t(opts.preheader) : undefined,
  });
  const text = [
    blocks.headline ? t(blocks.headline) : "",
    ...paras.map(t),
    blocks.buttonLabel && url ? `${t(blocks.buttonLabel)}: ${url}` : "",
    blocks.closing ? t(blocks.closing) : "",
  ].filter(Boolean).join("\n\n");
  return { html, text };
}

let _client: any = null;
const serviceClient = async () => {
  if (_client) return _client;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.41.0");
  _client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  return _client;
};

/** Stable Email Centre key for an operational sender label. */
export const opKey = (operation: string) =>
  `op.${operation.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;

/**
 * Apply Email Centre settings to an outgoing Resend payload.
 * Returns null when the email has been switched off; otherwise the (possibly
 * updated) payload. Any failure returns the payload untouched.
 * "intro" wording is added above the built-in content (reports, invoices,
 * secret-link emails keep their data); "replace" swaps the body.
 */
export async function applyTemplateToPayload<T extends Record<string, any>>(key: string, payload: T): Promise<T | null> {
  try {
    const admin = await serviceClient();
    const { data: t } = await admin
      .from("email_templates")
      .select("enabled, locked, subject, preheader, blocks, cc, bcc, wording_mode")
      .eq("key", key)
      .maybeSingle();
    if (!t) return payload;
    if (!isSendAllowed(t)) return null;
    const out: any = { ...payload };
    const cc = cleanAddresses(t.cc), bcc = cleanAddresses(t.bcc);
    if (cc.length) out.cc = [...(Array.isArray(out.cc) ? out.cc : out.cc ? [out.cc] : []), ...cc];
    if (bcc.length) out.bcc = [...(Array.isArray(out.bcc) ? out.bcc : out.bcc ? [out.bcc] : []), ...bcc];
    if (t.subject?.trim()) out.subject = fillVars(t.subject, {}, false);
    if (hasCustomBody(t.blocks) && typeof out.html === "string") {
      if (t.wording_mode === "replace") {
        const r = renderBlocks(t.blocks, {}, { subject: out.subject, preheader: t.preheader });
        out.html = r.html;
        out.text = r.text;
      } else {
        const b = t.blocks as TemplateBlocks;
        let intro = "";
        if (b.headline) intro += emailUI.heading(fillVars(b.headline, {}, true));
        for (const p of (b.paragraphs || []).filter((x) => x.trim())) intro += emailUI.paragraph(fillVars(p, {}, true).replace(/\n/g, "<br>"));
        const m = out.html.match(/<body[^>]*>/i);
        out.html = m ? out.html.replace(m[0], m[0] + intro) : intro + out.html;
        if (typeof out.text === "string") out.text = "";
      }
    }
    return out;
  } catch {
    return payload;
  }
}

/** Store the latest real copy of an email for the Email Centre preview. Never throws. */
export function saveSample(key: string | null | undefined, subject: string, html: string): void {
  if (!key || typeof html !== "string" || !html) return;
  (async () => {
    try {
      const admin = await serviceClient();
      await admin.from("email_templates")
        .update({ sample_subject: String(subject || "").slice(0, 300), sample_html: html.slice(0, 400_000), sample_at: new Date().toISOString() })
        .eq("key", key);
    } catch { /* preview capture must never affect sending */ }
  })();
}
