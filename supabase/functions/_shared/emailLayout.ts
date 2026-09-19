// Shared email design for every message this system sends.
//
// Emails cannot read the portal's CSS variables, so the portal palette is
// mirrored here once as email-safe literal values. Change it here and every
// email (customer, partner, internal, announcement) follows.
//
// `applyEmailBrand(html)` is intentionally forgiving: it takes whatever HTML a
// sender already produces, normalises the legacy inline styling, and wraps it in
// the standard header/card/footer. Wording, recipients and behaviour are never
// touched. Already-branded documents pass through untouched.

export const EMAIL_BRAND = {
  name: "Cycle Courier Co.",
  legalName: "Cycorco Ltd trading as Cycle Courier Co.",
  address: "30 Wake Green Road, Birmingham, B13 9PB",
  companyNo: "16220087",
  vatNo: "GB507727188",
  email: "Info@cyclecourierco.com",
  phone: "+44 121 798 0767",
  website: "https://booking.cyclecourierco.com",
  // Portal tokens, mirrored: primary 209 88% 37%, background 207 24% 96%,
  // foreground 213 14% 10%, muted-foreground 213 10% 40%, border 210 18% 87%.
  primary: "#0B61B1",
  primaryDark: "#084C8B",
  text: "#16191D",
  muted: "#5C6570",
  border: "#D8DEE4",
  panel: "#F2F5F7",
  page: "#EDF1F4",
  radius: "6px",
  font:
    "Overpass,'Overpass',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
} as const;

/** Marker used so a branded document is never wrapped twice. */
export const EMAIL_BRAND_MARKER = "ccc-email-shell";

const escapeHtml = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/**
 * Bring legacy hand-written inline styles into line with the portal:
 * old indigo buttons/links, Arial, 5px radii and grey panels.
 */
function normaliseLegacyStyles(html: string): string {
  return html
    .replace(/#4a65d5/gi, EMAIL_BRAND.primary)
    .replace(/#4A65D5/g, EMAIL_BRAND.primary)
    .replace(/#eef2ff/gi, EMAIL_BRAND.panel)
    .replace(/#f7f7f7|#f5f5f5|#fafafa/gi, EMAIL_BRAND.panel)
    .replace(/#e5e7eb|#eeeeee|#dddddd/gi, EMAIL_BRAND.border)
    .replace(/#0F766E|#0f766e/g, EMAIL_BRAND.primary)
    .replace(/#0B5A53|#0b5a53/g, EMAIL_BRAND.primaryDark)
    .replace(/font-family:\s*Arial,\s*sans-serif;?/gi, `font-family: ${EMAIL_BRAND.font};`)
    .replace(/font-family:\s*['"]?Helvetica Neue['"]?[^;"]*;?/gi, `font-family: ${EMAIL_BRAND.font};`)
    .replace(/border-radius:\s*(5px|8px|10px|12px)/gi, `border-radius: ${EMAIL_BRAND.radius}`);
}

export interface EmailShellOptions {
  /** Preheader / hidden preview text, usually the subject. */
  subject?: string;
  /** Small label under the wordmark, e.g. "Order update" or "Internal report". */
  eyebrow?: string;
  /** Internal reports are wider and denser than customer mail. */
  wide?: boolean;
  /** Set false to drop the company legal block (rare). */
  legalFooter?: boolean;
}

/** Wrap body HTML in the standard branded shell. */
export function emailShell(bodyHtml: string, options: EmailShellOptions = {}): string {
  const { subject = "", eyebrow = "", wide = false, legalFooter = true } = options;
  const width = wide ? 760 : 600;
  const B = EMAIL_BRAND;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body data-${EMAIL_BRAND_MARKER}="1" style="margin:0;padding:0;background:${B.page};font-family:${B.font};color:${B.text};-webkit-font-smoothing:antialiased;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(subject)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${B.page};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="${width}" cellpadding="0" cellspacing="0" border="0" style="max-width:${width}px;width:100%;background:#ffffff;border:1px solid ${B.border};border-radius:${B.radius};overflow:hidden;">
          <tr>
            <td style="background:${B.primary};padding:18px 24px;">
              <div style="font-size:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;">${B.name}</div>
              ${
                eyebrow
                  ? `<div style="margin-top:4px;font-size:12px;letter-spacing:0.04em;color:#DCE9F6;">${escapeHtml(eyebrow)}</div>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td style="padding:24px;font-size:15px;line-height:1.6;color:${B.text};">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid ${B.border};background:${B.panel};padding:18px 24px;font-size:12px;line-height:1.6;color:${B.muted};">
              <div style="font-weight:600;color:${B.text};">${B.name}</div>
              <div><a href="mailto:${B.email}" style="color:${B.primary};text-decoration:none;">${B.email}</a> &nbsp;&middot;&nbsp; ${B.phone}</div>
              <div><a href="${B.website}" style="color:${B.primary};text-decoration:none;">${B.website}</a></div>
              ${
                legalFooter
                  ? `<div style="margin-top:8px;">${B.legalName}, ${B.address}. Company no. ${B.companyNo}. VAT ${B.vatNo}.</div>`
                  : ""
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** True when the HTML is already a complete branded document. */
export function isBrandedEmail(html: string): boolean {
  return typeof html === "string" && html.includes(EMAIL_BRAND_MARKER);
}

/**
 * Give any email the shared design. Full documents that are already branded are
 * returned untouched; anything else is restyled and wrapped.
 */
export function applyEmailBrand(html: string, options: EmailShellOptions = {}): string {
  if (typeof html !== "string" || !html.trim()) return html;
  if (isBrandedEmail(html)) return normaliseLegacyStyles(html);

  let body = html;

  // Existing senders often wrap everything in their own 600px Arial div; the
  // shell provides that now, so unwrap the outer container when present.
  const outer = body.match(
    /^\s*<div[^>]*style="[^"]*max-width:\s*600px[^"]*"[^>]*>([\s\S]*)<\/div>\s*$/i,
  );
  if (outer) body = outer[1];

  // Full documents that are not ours: keep their structure, restyle only.
  if (/<html[\s>]/i.test(body)) return normaliseLegacyStyles(body);

  return emailShell(normaliseLegacyStyles(body), options);
}

/** Reusable pieces so new emails do not hand-roll styling. */
export const emailUI = {
  heading: (text: string) =>
    `<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;font-weight:700;color:${EMAIL_BRAND.text};">${text}</h1>`,
  paragraph: (text: string) =>
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${EMAIL_BRAND.text};">${text}</p>`,
  panel: (inner: string) =>
    `<div style="background:${EMAIL_BRAND.panel};border:1px solid ${EMAIL_BRAND.border};border-radius:${EMAIL_BRAND.radius};padding:14px 16px;margin:16px 0;font-size:14px;line-height:1.6;">${inner}</div>`,
  detailRow: (label: string, value: string) =>
    `<div style="margin:0 0 6px;"><span style="color:${EMAIL_BRAND.muted};">${label}:</span> <strong style="color:${EMAIL_BRAND.text};">${value}</strong></div>`,
  button: (href: string, label: string) =>
    `<div style="margin:22px 0;"><a href="${href}" style="display:inline-block;background:${EMAIL_BRAND.primary};color:#ffffff;font-weight:700;font-size:15px;padding:12px 20px;border-radius:${EMAIL_BRAND.radius};text-decoration:none;">${label}</a></div>`,
  link: (href: string, label = href) =>
    `<a href="${href}" style="color:${EMAIL_BRAND.primary};text-decoration:underline;word-break:break-all;">${label}</a>`,
};
