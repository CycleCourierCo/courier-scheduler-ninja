// No imports: tested directly by Vitest.

export function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Turn a failed create-quickbooks-invoice response into a short, plain message. */
export function summariseInvoiceError(status: number, body: string): string {
  const text = String(body ?? '');
  try {
    const parsed = JSON.parse(text);
    if (parsed?.error) return String(parsed.error).slice(0, 200);
  } catch { /* not JSON */ }
  if (/<\s*(html|head|body|title)/i.test(text)) {
    return status >= 500
      ? `QuickBooks invoicing temporarily unavailable (${status})`
      : `Invoice request failed (${status})`;
  }
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return (trimmed ? `Invoice request failed (${status}): ${trimmed}` : `Invoice request failed (${status})`).slice(0, 200);
}

/** Clean an already-stored error message (older rows may hold raw HTML). */
export function cleanStoredError(msg: string): string {
  const m = String(msg ?? '');
  const code = m.match(/\b(5\d\d)\b/)?.[1];
  if (/<\s*(html|head|body|title)/i.test(m)) {
    return code ? `QuickBooks invoicing temporarily unavailable (${code})` : 'Invoice request failed';
  }
  return m.slice(0, 200);
}

export function isRetryableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}
