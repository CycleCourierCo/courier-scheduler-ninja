/**
 * Shared HTML helpers for internal operational report emails.
 * Kept deliberately simple: inline styles only, table-based layout so the
 * output renders the same in Outlook, Gmail and Apple Mail.
 */

export const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const money = (n: number): string =>
  `£${(Number(n) || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const num = (v: unknown): number => Number(v) || 0;

export const pct = (part: number, total: number): string =>
  total > 0 ? `${Math.round((part / total) * 100)}%` : "—";

export interface StatCard {
  label: string;
  value: string | number;
  tone?: "good" | "bad" | "warn";
}

const TONE: Record<string, string> = {
  good: "#0f7b3f",
  bad: "#b42318",
  warn: "#b54708",
};

export const statGrid = (stats: StatCard[]): string => {
  const cells = stats
    .map(
      (s) => `
      <td style="padding:10px 12px;border:1px solid #e6e6e6;border-radius:6px;background:#fafafa;min-width:110px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#666;">${esc(s.label)}</div>
        <div style="font-size:20px;font-weight:700;color:${s.tone ? TONE[s.tone] : "#111"};margin-top:2px;">${esc(s.value)}</div>
      </td>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="8" style="border-collapse:separate;margin:0 0 8px -8px;"><tr>${cells}</tr></table>`;
};

export const section = (title: string, body: string): string => `
  <div style="margin:26px 0 0;">
    <h2 style="font-size:16px;margin:0 0 10px;color:#111;border-bottom:2px solid #111;padding-bottom:6px;">${esc(title)}</h2>
    ${body}
  </div>`;

export const table = (headers: string[], rows: (string | number)[][], note?: string): string => {
  if (rows.length === 0) {
    return `<p style="margin:0;color:#666;font-size:13px;">${esc(note || "Nothing to report.")}</p>`;
  }
  const head = headers
    .map(
      (h, i) =>
        `<th style="text-align:${i === 0 ? "left" : "right"};padding:6px 8px;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#666;border-bottom:1px solid #ddd;">${esc(h)}</th>`,
    )
    .join("");
  const body = rows
    .map(
      (r, ri) =>
        `<tr style="background:${ri % 2 ? "#fafafa" : "#fff"};">${r
          .map(
            (c, i) =>
              `<td style="text-align:${i === 0 ? "left" : "right"};padding:6px 8px;font-size:13px;color:#111;border-bottom:1px solid #f0f0f0;">${
                typeof c === "string" && c.startsWith("<") ? c : esc(c)
              }</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
    <thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
};

export const list = (items: string[], empty = "Nothing to report."): string => {
  if (items.length === 0) return `<p style="margin:0;color:#666;font-size:13px;">${esc(empty)}</p>`;
  return `<ul style="margin:0;padding-left:18px;color:#111;font-size:13px;line-height:1.6;">${items
    .map((i) => `<li>${i}</li>`)
    .join("")}</ul>`;
};

export const wrap = (title: string, subtitle: string, body: string): string => `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f4f5;">
  <div style="max-width:720px;margin:0 auto;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="background:#ffffff;border-radius:10px;padding:24px;">
      <h1 style="font-size:20px;margin:0;color:#111;">${esc(title)}</h1>
      <p style="margin:4px 0 0;color:#666;font-size:13px;">${esc(subtitle)}</p>
      ${body}
      <p style="margin:28px 0 0;color:#999;font-size:11px;border-top:1px solid #eee;padding-top:12px;">
        Automated internal report from Cycle Courier Co. operations.
      </p>
    </div>
  </div>
</body></html>`;
