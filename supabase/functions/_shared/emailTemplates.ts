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
      .select("key, enabled, locked, is_custom, subject, preheader, blocks, recipients, cc, bcc")
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

export { hasCustomBody };
