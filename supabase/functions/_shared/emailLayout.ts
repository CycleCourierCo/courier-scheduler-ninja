// Shared email design for every message this system sends.
//
// Implements ccc-email-design.md v1.0. Emails cannot read the portal's CSS
// variables, so the portal palette is mirrored here once as email-safe literal
// values. Change it here and every email (customer, partner, internal,
// announcement) follows.
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
  // Portal tokens, mirrored exactly (ccc-email-design.md §1).
  primary: "#0B5FB0",
  primaryDark: "#084C8B",
  primaryText: "#FFFFFF",
  text: "#16191D",
  muted: "#5B6470",
  border: "#D9DFE5",
  panel: "#F2F5F7",
  page: "#EDF1F4",
  surface: "#FFFFFF",
  routeTint: "#E3EEF8",
  radius: "6px",
  font:
    "Overpass,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  mono: "'Overpass Mono',ui-monospace,SFMono-Regular,Consolas,'Courier New',monospace",
} as const;

/** Status tokens — mirror ccc-design.md §2. Yellow only when a human must act. */
export const EMAIL_STATUS = {
  neutral: { bg: "#6B7580", text: "#FFFFFF" },
  waiting: { bg: "#F5B800", text: "#16191D" },
  booked: { bg: "#0B5FB0", text: "#FFFFFF" },
  transit: { bg: "#6B4FBF", text: "#FFFFFF" },
  done: { bg: "#1E7A46", text: "#FFFFFF" },
  failed: { bg: "#C22F2E", text: "#FFFFFF" },
  ni: { bg: "#3F51B5", text: "#FFFFFF" },
  trunk: { bg: "#0E7C8C", text: "#FFFFFF" },
  inspection: { bg: "#2B8CD8", text: "#FFFFFF" },
} as const;

export type EmailStatusToken = keyof typeof EMAIL_STATUS;

/** Lifecycle strip-map branches (ccc-email-design.md §3.2). */
export const STRIP_BRANCHES = {
  standard: ["Booked", "Dates", "Collected", "In transit", "Delivered"],
  box: ["Booked", "At depot", "Boxed", "Courier collected", "Delivered"],
  niOutbound: ["Booked", "Collected", "Foamed", "At ferry", "Delivered NI"],
  niInbound: ["Booked", "Collected NI", "Crossed ferry", "With us", "Delivered"],
  scotlandTrunk: ["Booked", "Collected", "Trunk north", "At depot", "Delivered"],
  workshop: ["Booked", "Collected", "Inspected", "Repairs", "Delivered"],
} as const;

export type StripBranch = keyof typeof STRIP_BRANCHES;

/** Pick the strip-map branch that matches an order's lifecycle. */
export const stagesForOrder = (order: any): readonly string[] => {
  if (order?.is_box_my_bike) return STRIP_BRANCHES.box;
  if (order?.ni_direction === "inbound") return STRIP_BRANCHES.niInbound;
  if (order?.is_northern_ireland || order?.foam_status) return STRIP_BRANCHES.niOutbound;
  if (order?.needs_inspection) return STRIP_BRANCHES.workshop;
  return STRIP_BRANCHES.standard;
};

const EMAIL_LOGO_URL = "https://courier-scheduler-ninja.lovable.app/__l5e/assets-v1/51b80c2a-5208-455f-87d8-ac99bb81b6b7/lockup-horizontal-reversed.png";

/** Index of the first matching stage label, else a fallback. */
export const stageIndex = (stages: readonly string[], labels: string[], fallback: number): number => {
  for (const label of labels) {
    const i = stages.indexOf(label);
    if (i >= 0) return i;
  }
  return fallback;
};

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
    .replace(/#0B61B1/gi, EMAIL_BRAND.primary)
    .replace(/#5C6570/gi, EMAIL_BRAND.muted)
    .replace(/#D8DEE4/gi, EMAIL_BRAND.border)
    .replace(/font-family:\s*Arial,\s*sans-serif;?/gi, `font-family: ${EMAIL_BRAND.font};`)
    .replace(/font-family:\s*['"]?Helvetica Neue['"]?[^;"]*;?/gi, `font-family: ${EMAIL_BRAND.font};`)
    .replace(/border-radius:\s*(5px|8px|10px|12px)/gi, `border-radius: ${EMAIL_BRAND.radius}`);
}

export interface EmailShellOptions {
  /** Subject — used for the document title and as the preheader fallback. */
  subject?: string;
  /** Hidden inbox preview line. Read far more often than the body — set it. */
  preheader?: string;
  /** One-word context label beside the wordmark, e.g. "COLLECTION". */
  eyebrow?: string;
  /** Internal reports are wider and denser than customer mail (760px). */
  wide?: boolean;
  /** Exception treatment: 6px amber bar under the header. Human must act. */
  chevron?: boolean;
  /** Set false to drop the company legal block (partner/operational mail). */
  legalFooter?: boolean;
  /** Extra footer links, e.g. an unsubscribe link for announcements. */
  footerExtra?: string;
}

/** Wrap body HTML in the standard branded shell. */
export function emailShell(bodyHtml: string, options: EmailShellOptions = {}): string {
  const {
    subject = "",
    preheader = "",
    eyebrow = "",
    wide = false,
    chevron = false,
    legalFooter = true,
    footerExtra = "",
  } = options;
  const width = wide ? 760 : 600;
  const B = EMAIL_BRAND;
  const preview = preheader || subject;
  // Stop clients pulling footer text into the inbox preview.
  const preheaderPad = "&#847;&zwnj;&nbsp;".repeat(40);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body data-${EMAIL_BRAND_MARKER}="1" style="margin:0;padding:0;background:${B.page};font-family:${B.font};color:${B.text};-webkit-font-smoothing:antialiased;color-scheme:light;">
  <div style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;">${escapeHtml(preview)}${preheaderPad}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${B.page};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="${width}" cellpadding="0" cellspacing="0" border="0" style="max-width:${width}px;width:100%;background:${B.surface};border:1px solid ${B.border};border-radius:${B.radius};overflow:hidden;">
          <tr>
            <td style="background:${B.primary};padding:20px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                   <td align="left"><img src="${EMAIL_LOGO_URL}" alt="${B.name}" width="240" height="48" style="width:240px;max-width:100%;height:auto;display:block;border:0;outline:none;text-decoration:none;"></td>
                  ${
                    eyebrow
                      ? `<td align="right" style="font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${B.primaryText};opacity:0.7;">${escapeHtml(eyebrow)}</td>`
                      : ""
                  }
                </tr>
              </table>
            </td>
          </tr>
          ${
            chevron
              ? `<tr><td style="height:6px;line-height:6px;font-size:0;background:#F5B800;">&nbsp;</td></tr>`
              : ""
          }
          <tr>
            <td style="padding:32px;font-size:16px;line-height:1.6;color:${B.text};">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid ${B.border};background:${B.panel};padding:24px;font-size:13px;line-height:1.5;color:${B.muted};">
              <div style="font-weight:600;color:${B.text};">${B.name}</div>
              <div><a href="mailto:${B.email}" style="color:${B.primary};text-decoration:none;">${B.email}</a> &nbsp;&middot;&nbsp; ${B.phone}</div>
              <div><a href="${B.website}" style="color:${B.primary};text-decoration:none;">${B.website}</a></div>
              ${
                legalFooter
                  ? `<div style="margin-top:8px;">${B.legalName}, ${B.address}. Company no. ${B.companyNo}. VAT ${B.vatNo}.</div>`
                  : ""
              }
              ${footerExtra ? `<div style="margin-top:8px;">${footerExtra}</div>` : ""}
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

  // Full documents that are not ours: lift the body content into our shell so
  // the header, footer and palette match everything else. If the body cannot be
  // isolated, restyle in place rather than risk mangling the document.
  if (/<html[\s>]/i.test(body)) {
    const inner = body.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (!inner) return normaliseLegacyStyles(body);
    body = inner[1];
  }

  return emailShell(normaliseLegacyStyles(body), options);
}

/**
 * Generate the plain-text alternative for an HTML email. Every send must ship
 * one — its absence is a spam signal and breaks accessibility.
 */
export function htmlToPlainText(html: string): string {
  if (typeof html !== "string") return "";

  // This is a single-pass character scanner, not regex-based HTML stripping.
  // Markup is removed structurally before any entity decoding happens, and
  // each entity is decoded exactly once with no re-scan, so there is no path
  // for stripped or decoded content to re-form markup (CodeQL:
  // js/incomplete-multi-character-sanitization, js/bad-tag-filter,
  // js/double-escaping).
  const len = html.length;
  const DROP_CONTENT_TAGS = new Set(["script", "style", "head"]);
  const NEWLINE_ON_CLOSE_TAGS = new Set(["p", "div", "tr", "h1", "h2", "h3", "li", "table"]);
  const NAMED_ENTITIES: Record<string, string> = {
    nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
    middot: "·", zwnj: "", "#847": "", "#39": "'", "#8217": "'",
    "#8211": "–", "#8212": "—", "#8220": '"', "#8221": '"',
  };
  const ZERO_WIDTH_CODEPOINTS = new Set([0x200b, 0x200c, 0x200d, 0xfeff]);

  const out: string[] = [];

  /** Case-insensitive substring search without regex. `needle` must be lowercase. */
  const lowerIndexOf = (needle: string, from: number): number => {
    const nl = needle.length;
    outer: for (let s = from; s + nl <= len; s++) {
      for (let k = 0; k < nl; k++) {
        if (html[s + k].toLowerCase() !== needle[k]) continue outer;
      }
      return s;
    }
    return -1;
  };

  /** Read a tag name starting at `start` (just after `<` or `</`). */
  const readTag = (start: number): { name: string; closing: boolean; afterName: number } => {
    let p = start;
    let closing = false;
    if (html[p] === "/") { closing = true; p++; }
    let name = "";
    while (p < len) {
      const c = html[p];
      const lc = c.toLowerCase();
      if ((lc >= "a" && lc <= "z") || (c >= "0" && c <= "9")) { name += lc; p++; } else break;
    }
    return { name, closing, afterName: p };
  };

  /** Advance past the next `>` that is not inside a quoted attribute value. */
  const skipTagEnd = (p: number): number => {
    let quote = "";
    while (p < len) {
      const c = html[p];
      if (quote) { if (c === quote) quote = ""; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === ">") return p + 1;
      p++;
    }
    return p;
  };

  /** Extract the href value from a raw `<a ...>` tag fragment without regex. */
  const extractHref = (tagText: string): string => {
    const lower = tagText.toLowerCase();
    let p = lower.indexOf("href");
    while (p !== -1) {
      let q = p + 4;
      while (q < lower.length && (lower[q] === " " || lower[q] === "\t")) q++;
      if (lower[q] === "=") {
        q++;
        while (q < lower.length && (lower[q] === " " || lower[q] === "\t")) q++;
        const quote = lower[q];
        if (quote === '"' || quote === "'") {
          const end = lower.indexOf(quote, q + 1);
          return end === -1 ? tagText.slice(q + 1) : tagText.slice(q + 1, end);
        }
        let end = q;
        while (end < lower.length && lower[end] !== " " && lower[end] !== "\t" && lower[end] !== ">") end++;
        return tagText.slice(q, end);
      }
      p = lower.indexOf("href", p + 4);
    }
    return "";
  };

  let pos = 0;
  while (pos < len) {
    const ch = html[pos];

    if (ch === "<") {
      // Comments and declarations: <!-- ... -->, <!DOCTYPE ...>, <? ... ?>
      if (html.startsWith("!--", pos + 1)) {
        const end = html.indexOf("-->", pos + 4);
        pos = end === -1 ? len : end + 3;
        continue;
      }
      if (html[pos + 1] === "!" || html[pos + 1] === "?") {
        pos = skipTagEnd(pos + 2);
        continue;
      }
      const tag = readTag(pos + 1);
      if (!tag.name) {
        // A lone `<` that does not open a tag — keep it as literal text.
        out.push("<");
        pos++;
        continue;
      }
      const tagEnd = skipTagEnd(tag.afterName);

      if (tag.closing) {
        if (NEWLINE_ON_CLOSE_TAGS.has(tag.name)) out.push("\n");
        else if (tag.name === "td" || tag.name === "th") out.push("  ");
        pos = tagEnd;
        continue;
      }
      if (DROP_CONTENT_TAGS.has(tag.name)) {
        // Drop the element and its entire contents. The end tag is located by
        // scanning (not a regex), so `</script >`-style variants are matched.
        const close = lowerIndexOf("</" + tag.name, tagEnd);
        pos = close === -1 ? tagEnd : skipTagEnd(close + tag.name.length + 2);
        continue;
      }
      if (tag.name === "br") { out.push("\n"); pos = tagEnd; continue; }
      if (tag.name === "li") { out.push("- "); pos = tagEnd; continue; }
      if (tag.name === "a") {
        const href = extractHref(html.slice(pos, tagEnd));
        const close = lowerIndexOf("</a", tagEnd);
        const innerEnd = close === -1 ? len : close;
        const text = htmlToPlainText(html.slice(tagEnd, innerEnd)).replace(/\s+/g, " ").trim();
        if (href && text && text !== href) out.push(`${text} (${href})`);
        else out.push(text || href || "");
        pos = close === -1 ? len : skipTagEnd(close + 2);
        continue;
      }
      pos = tagEnd;
      continue;
    }

    if (ch === "&") {
      const semi = html.indexOf(";", pos + 1);
      if (semi !== -1 && semi - pos <= 10) {
        const name = html.slice(pos + 1, semi).toLowerCase();
        if (name in NAMED_ENTITIES) {
          out.push(NAMED_ENTITIES[name]);
          pos = semi + 1;
          continue;
        }
        if (name[0] === "#") {
          const code = Number(name.slice(1));
          if (Number.isInteger(code) && code >= 0 && code <= 0x10ffff) {
            if (!ZERO_WIDTH_CODEPOINTS.has(code) && code !== 847) {
              out.push(String.fromCodePoint(code));
            }
            pos = semi + 1;
            continue;
          }
        }
        // Unknown entity — emit it literally rather than dropping content.
        out.push(html.slice(pos, semi + 1));
        pos = semi + 1;
        continue;
      }
      out.push("&");
      pos++;
      continue;
    }

    const code = ch.codePointAt(0)!;
    if (ZERO_WIDTH_CODEPOINTS.has(code)) { pos += ch.length; continue; }
    out.push(ch);
    pos++;
  }

  return out.join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Reusable pieces so new emails do not hand-roll styling. */
export const emailUI = {
  heading: (text: string) =>
    `<h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:700;color:${EMAIL_BRAND.text};">${text}</h1>`,
  paragraph: (text: string) =>
    `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${EMAIL_BRAND.text};">${text}</p>`,
  small: (text: string) =>
    `<p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:${EMAIL_BRAND.muted};">${text}</p>`,
  mono: (text: string) =>
    `<span style="font-family:${EMAIL_BRAND.mono};font-size:15px;font-weight:600;color:${EMAIL_BRAND.text};">${text}</span>`,
  panel: (inner: string) =>
    `<div style="background:${EMAIL_BRAND.panel};border:1px solid ${EMAIL_BRAND.border};border-radius:${EMAIL_BRAND.radius};padding:20px;margin:16px 0;font-size:14px;line-height:1.6;color:${EMAIL_BRAND.text};">${inner}</div>`,
  detailRow: (label: string, value: string) =>
    `<div style="margin:0 0 6px;"><span style="color:${EMAIL_BRAND.muted};">${label}:</span> <strong style="color:${EMAIL_BRAND.text};">${value}</strong></div>`,

  /** §3.3 — label/value detail panel. Pass mono=true for refs, postcodes, slots. */
  detailPanel: (rows: Array<{ label: string; value: string; mono?: boolean }>) => {
    const body = rows
      .slice(0, 6)
      .map(
        (r) => `<tr>
          <td style="padding:6px 12px 6px 0;font-size:12px;line-height:1.4;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:${EMAIL_BRAND.muted};vertical-align:top;white-space:nowrap;">${escapeHtml(r.label)}</td>
          <td style="padding:6px 0;font-size:16px;line-height:1.45;font-weight:600;color:${EMAIL_BRAND.text};${r.mono ? `font-family:${EMAIL_BRAND.mono};` : ""}">${r.value}</td>
        </tr>`,
      )
      .join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_BRAND.panel};border:1px solid ${EMAIL_BRAND.border};border-radius:${EMAIL_BRAND.radius};padding:14px 20px;margin:16px 0;">${body}</table>`;
  },

  /** §3.2 — the strip map. Completed cells blue, current blue, upcoming edge. */
  stripMap: (stages: readonly string[] | string[], currentIndex: number) => {
    const B = EMAIL_BRAND;
    const cells = stages
      .map((label, i) => {
        const done = i <= currentIndex;
        const current = i === currentIndex;
        const bar = done ? B.primary : B.border;
        const labelColor = current ? B.text : B.muted;
        const weight = current ? 700 : 400;
        return `<td width="${Math.floor(100 / stages.length)}%" style="padding:0 2px;">
          <div style="height:4px;background:${bar};font-size:0;line-height:4px;">&nbsp;</div>
          <div style="font-family:${B.font};font-size:11px;line-height:1.3;font-weight:${weight};color:${labelColor};padding-top:8px;">${escapeHtml(label)}</div>
        </td>`;
      })
      .join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr>${cells}</tr></table>`;
  },

  /** §3.4 — status pill. Always carries the word, never colour alone. */
  statusPill: (token: EmailStatusToken, label: string) => {
    const t = EMAIL_STATUS[token];
    return `<span style="display:inline-block;background:${t.bg};color:${t.text};font-size:13px;font-weight:600;line-height:1;padding:6px 12px;border-radius:4px;">${escapeHtml(label)}</span>`;
  },

  /** §3.6 — bulletproof primary button with Outlook VML fallback. */
  button: (href: string, label: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;"><tr><td align="center" bgcolor="${EMAIL_BRAND.primary}" style="border-radius:4px;">
      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${href}" style="height:44px;v-text-anchor:middle;width:220px;" fillcolor="${EMAIL_BRAND.primary}" stroke="f"><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:16px;font-weight:600;">${escapeHtml(label)}</center></v:roundrect><![endif]-->
      <!--[if !mso]><!--><a href="${href}" style="display:inline-block;background:${EMAIL_BRAND.primary};color:#FFFFFF;font-family:${EMAIL_BRAND.font};font-weight:600;font-size:16px;padding:14px 28px;border-radius:4px;text-decoration:none;min-height:44px;line-height:1.2;">${escapeHtml(label)}</a><!--<![endif]-->
    </td></tr></table>`,

  /** §3.6 — secondary button (review links on the delivered email). */
  secondaryButton: (href: string, label: string) =>
    `<a href="${href}" style="display:inline-block;background:#FFFFFF;color:${EMAIL_BRAND.primary};border:1px solid ${EMAIL_BRAND.primary};font-family:${EMAIL_BRAND.font};font-weight:600;font-size:15px;padding:11px 20px;border-radius:4px;text-decoration:none;margin:4px 8px 4px 0;">${escapeHtml(label)}</a>`,

  link: (href: string, label = href) =>
    `<a href="${href}" style="color:${EMAIL_BRAND.primary};text-decoration:underline;word-break:break-all;">${label}</a>`,

  /** §3.7 — internal report table. Figures right-aligned and mono. */
  table: (headers: string[], rows: string[][]) => {
    const B = EMAIL_BRAND;
    const head = headers
      .map(
        (h, i) =>
          `<th align="${i === headers.length - 1 && headers.length > 1 ? "right" : "left"}" style="padding:8px 12px;font-size:12px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:${B.muted};background:${B.panel};border-bottom:1px solid ${B.border};">${escapeHtml(h)}</th>`,
      )
      .join("");
    const body = rows
      .map(
        (r) =>
          `<tr>${r
            .map(
              (c, i) =>
                `<td align="${i === r.length - 1 && r.length > 1 ? "right" : "left"}" style="padding:10px 12px;font-size:14px;line-height:1.4;color:${B.text};border-bottom:1px solid ${B.border};${i === r.length - 1 && r.length > 1 ? `font-family:${B.mono};` : ""}">${c}</td>`,
            )
            .join("")}</tr>`,
      )
      .join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border-collapse:collapse;">${head}${body}</table>`;
  },

  /** §3.7 — totals row: 600 weight, 2px top border, no fill. */
  totalsRow: (label: string, value: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;border-top:2px solid ${EMAIL_BRAND.text};"><tr>
      <td style="padding:10px 12px;font-size:14px;font-weight:600;color:${EMAIL_BRAND.text};">${escapeHtml(label)}</td>
      <td align="right" style="padding:10px 12px;font-size:14px;font-weight:600;color:${EMAIL_BRAND.text};font-family:${EMAIL_BRAND.mono};">${value}</td>
    </tr></table>`,

  /** §3.9 — attachment note for document emails. */
  attachmentNote: (fileName: string, attached: boolean, linkHref?: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_BRAND.panel};border:1px solid ${EMAIL_BRAND.border};border-radius:${EMAIL_BRAND.radius};margin:16px 0;"><tr>
      <td style="padding:14px 20px;font-size:14px;color:${EMAIL_BRAND.text};">
        <span style="font-family:${EMAIL_BRAND.mono};font-weight:600;">${escapeHtml(fileName)}</span>
        <span style="color:${EMAIL_BRAND.muted};"> — ${attached ? "attached to this email as a PDF" : "available to download"}</span>
        ${linkHref ? `<div style="margin-top:6px;"><a href="${linkHref}" style="color:${EMAIL_BRAND.primary};text-decoration:underline;">Download</a></div>` : ""}
      </td>
    </tr></table>`,
};
