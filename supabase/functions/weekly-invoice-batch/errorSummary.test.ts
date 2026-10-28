import { describe, it, expect } from 'vitest';
import { summariseInvoiceError, cleanStoredError, escapeHtml, isRetryableStatus } from './errorSummary';

describe('invoice batch error summary', () => {
  it('turns an HTML 502 page into a short message', () => {
    expect(summariseInvoiceError(502, '<html><head><title>502 Bad Gateway</title></head></html>'))
      .toBe('QuickBooks invoicing temporarily unavailable (502)');
  });
  it('keeps the JSON error message', () => {
    expect(summariseInvoiceError(400, '{"error":"Customer not found"}')).toBe('Customer not found');
  });
  it('cleans old stored HTML errors', () => {
    expect(cleanStoredError('create-quickbooks-invoice 502: <html><head>'))
      .toBe('QuickBooks invoicing temporarily unavailable (502)');
  });
  it('escapes HTML', () => {
    expect(escapeHtml('<b>')).toBe('&lt;b&gt;');
  });
  it('retries only gateway errors', () => {
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(400)).toBe(false);
  });
});
