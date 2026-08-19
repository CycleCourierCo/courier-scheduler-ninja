// Shared best-effort helpers for making QuickBooks invoices reachable by customers.
// A QuickBooks admin URL (qbo.intuit.com/app/invoice?txnId=...) requires the account
// holder to log in, so customer emails need the public shareable link, a PDF copy,
// and (optionally) QuickBooks' own branded invoice email.
//
// Every helper is best-effort: failures are logged (status + body, no PII) and the
// caller receives null/false so invoice creation never breaks.

const QB_BASE = 'https://quickbooks.api.intuit.com/v3/company';

function authHeaders(accessToken: string, accept = 'application/json') {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: accept,
  };
}

/**
 * Fetches the public, no-login "share link" for an invoice.
 * Only present when online invoicing / QuickBooks Payments is enabled for the company.
 */
export async function getInvoicePublicLink(
  accessToken: string,
  companyId: string,
  invoiceId: string
): Promise<string | null> {
  if (!invoiceId) return null;
  try {
    const res = await fetch(
      `${QB_BASE}/${companyId}/invoice/${invoiceId}?include=invoiceLink&minorversion=70`,
      { headers: authHeaders(accessToken) }
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`QuickBooks invoiceLink fetch failed [${res.status}]: ${body.slice(0, 500)}`);
      return null;
    }

    const json = await res.json();
    const link = json?.Invoice?.InvoiceLink || null;
    if (!link) {
      console.log('QuickBooks returned no InvoiceLink (online invoicing likely disabled)');
    }
    return link;
  } catch (err) {
    console.error('QuickBooks invoiceLink fetch threw:', (err as Error)?.message);
    return null;
  }
}

/**
 * Downloads the invoice PDF and returns it base64-encoded, ready to attach to a Resend email.
 */
export async function getInvoicePdfBase64(
  accessToken: string,
  companyId: string,
  invoiceId: string
): Promise<string | null> {
  if (!invoiceId) return null;
  try {
    const res = await fetch(`${QB_BASE}/${companyId}/invoice/${invoiceId}/pdf?minorversion=70`, {
      headers: authHeaders(accessToken, 'application/pdf'),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`QuickBooks invoice PDF fetch failed [${res.status}]: ${body.slice(0, 500)}`);
      return null;
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  } catch (err) {
    console.error('QuickBooks invoice PDF fetch threw:', (err as Error)?.message);
    return null;
  }
}

/**
 * Asks QuickBooks to email its own branded invoice (with pay-now link) to the address given.
 */
export async function sendInvoiceViaQuickBooks(
  accessToken: string,
  companyId: string,
  invoiceId: string,
  email?: string | null
): Promise<boolean> {
  if (!invoiceId) return false;
  try {
    const url = email
      ? `${QB_BASE}/${companyId}/invoice/${invoiceId}/send?sendTo=${encodeURIComponent(email)}&minorversion=70`
      : `${QB_BASE}/${companyId}/invoice/${invoiceId}/send?minorversion=70`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { ...authHeaders(accessToken), 'Content-Type': 'application/octet-stream' },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`QuickBooks send-invoice failed [${res.status}]: ${body.slice(0, 500)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('QuickBooks send-invoice threw:', (err as Error)?.message);
    return false;
  }
}

export type InvoiceDelivery = {
  publicUrl: string | null;
  pdfBase64: string | null;
  quickbooksEmailSent: boolean;
};

/**
 * Convenience wrapper: public link + PDF + QuickBooks email in one call.
 */
export async function prepareInvoiceDelivery(
  accessToken: string,
  companyId: string,
  invoiceId: string,
  billEmail?: string | null,
  options: { sendViaQuickBooks?: boolean; fetchPdf?: boolean } = {}
): Promise<InvoiceDelivery> {
  const { sendViaQuickBooks = true, fetchPdf = true } = options;

  const [publicUrl, pdfBase64, quickbooksEmailSent] = await Promise.all([
    getInvoicePublicLink(accessToken, companyId, invoiceId),
    fetchPdf ? getInvoicePdfBase64(accessToken, companyId, invoiceId) : Promise.resolve(null),
    sendViaQuickBooks && billEmail
      ? sendInvoiceViaQuickBooks(accessToken, companyId, invoiceId, billEmail)
      : Promise.resolve(false),
  ]);

  return { publicUrl, pdfBase64, quickbooksEmailSent };
}

/**
 * Builds the customer-facing invoice CTA. Falls back to "PDF attached" copy when
 * QuickBooks did not return a public link.
 */
export function buildInvoiceCtaHtml(publicUrl: string | null, hasPdf: boolean): string {
  if (publicUrl) {
    return `
      <p style="margin: 24px 0;">
        <a href="${publicUrl}" style="background-color: #4a65d5; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View &amp; pay invoice
        </a>
      </p>
      ${hasPdf ? '<p style="font-size: 13px; color: #666;">A PDF copy of the invoice is attached to this email.</p>' : ''}
    `;
  }
  return hasPdf
    ? '<p style="margin: 24px 0;">Your invoice is attached to this email as a PDF.</p>'
    : '<p style="margin: 24px 0;">Please contact us if you need a copy of this invoice.</p>';
}

export function buildInvoiceCtaText(publicUrl: string | null, hasPdf: boolean): string {
  if (publicUrl) {
    return `View and pay your invoice: ${publicUrl}${hasPdf ? '\nA PDF copy is attached to this email.' : ''}`;
  }
  return hasPdf
    ? 'Your invoice is attached to this email as a PDF.'
    : 'Please contact us if you need a copy of this invoice.';
}
