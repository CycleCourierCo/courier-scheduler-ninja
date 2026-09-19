/**
 * Branded announcement email template for Cycle Courier Co.
 *
 * Use `wrapAnnouncementEmail(content, subject)` to wrap plain text or simple
 * HTML inside the company's branded header/footer. Plain-text line breaks are
 * automatically converted into paragraphs so users can just type their message.
 */

const BRAND = {
  name: "Cycle Courier Co.",
  legalName: "Cycorco Ltd trading as Cycle Courier Co.",
  address: "30 Wake Green Road, Birmingham, B13 9PB",
  companyNo: "16220087",
  vatNo: "GB507727188",
  email: "info@cyclecourierco.com",
  phone: "+44 121 798 0767",
  website: "https://booking.cyclecourierco.com",
  primary: "#0B61B1", // motorway blue (portal primary)
  primaryDark: "#084C8B",
  text: "#16191D",
  muted: "#5C6570",
  border: "#D8DEE4",
  bg: "#EDF1F4",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Turn raw user input into safe paragraph HTML.
 * - If the input already contains block-level HTML tags, use it as-is.
 * - Otherwise split on blank lines into <p> blocks and convert single
 *   line breaks into <br>.
 */
function normaliseBody(input: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";

  const looksLikeHtml = /<\s*(p|div|h[1-6]|ul|ol|table|section|article|br|img|a)\b/i.test(trimmed);
  if (looksLikeHtml) return trimmed;

  return trimmed
    .split(/\n\s*\n/)
    .map(
      (para) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.text};">${escapeHtml(
          para
        ).replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

export function buildPlainText(content: string): string {
  return (content || "")
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function wrapAnnouncementEmail(content: string, subject: string): string {
  const bodyHtml = normaliseBody(content);
  const safeSubject = escapeHtml(subject || "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${safeSubject}</title>
</head>
<body data-ccc-email-shell="1" style="margin:0;padding:0;background:${BRAND.bg};font-family:Overpass,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;">${safeSubject}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:6px;overflow:hidden;border:1px solid ${BRAND.border};">
          <!-- Header -->
          <tr>
            <td style="background:${BRAND.primary};padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.2px;">
                    ${BRAND.name}
                  </td>
                  <td align="right">
                    <img src="https://booking.cyclecourierco.com/cycle-courier-logo.png" alt="Cycle Courier Co." height="48" style="height:48px;width:auto;display:block;border:0;outline:none;text-decoration:none;background:#ffffff;border-radius:6px;padding:4px;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:${BRAND.text};font-weight:700;">${safeSubject}</h1>
              ${bodyHtml}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background:${BRAND.border};"></div>
            </td>
          </tr>

          <!-- Contact strip -->
          <tr>
            <td style="padding:20px 32px;font-size:13px;color:${BRAND.muted};">
              Need help? Email
              <a href="mailto:${BRAND.email}" style="color:${BRAND.primary};text-decoration:none;">${BRAND.email}</a>
              or call <a href="tel:${BRAND.phone.replace(/\s+/g, "")}" style="color:${BRAND.primary};text-decoration:none;">${BRAND.phone}</a>.
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F2F5F7;padding:20px 32px;font-size:11px;line-height:1.5;color:${BRAND.muted};text-align:center;">
              <div style="margin-bottom:6px;">
                <a href="${BRAND.website}" style="color:${BRAND.primary};text-decoration:none;font-weight:600;">${BRAND.website.replace(/^https?:\/\//, "")}</a>
              </div>
              ${BRAND.legalName}<br>
              Registered office: ${BRAND.address}<br>
              Company No: ${BRAND.companyNo} &middot; VAT No: ${BRAND.vatNo}
            </td>
          </tr>
        </table>
        <div style="max-width:600px;margin:12px auto 0;font-size:11px;color:${BRAND.muted};text-align:center;">
          You're receiving this email because you have an account with ${BRAND.name}.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
