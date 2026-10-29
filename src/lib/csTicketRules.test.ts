import { describe, it, expect } from 'vitest';
import { inWhatsAppWindow, canReopenClosed } from '../../supabase/functions/_shared/csTicketRules';

const now = new Date('2026-10-29T12:00:00Z').getTime();
const ago = (h: number) => new Date(now - h * 3600_000).toISOString();

describe('ticket closing rules', () => {
  it('sends a WhatsApp closing message only within 24 hours of the last customer message', () => {
    expect(inWhatsAppWindow(ago(23), now)).toBe(true);
    expect(inWhatsAppWindow(ago(25), now)).toBe(false);
  });
  it('reopens a closed ticket when the customer replies within 7 days, otherwise not', () => {
    expect(canReopenClosed(ago(6 * 24), now)).toBe(true);
    expect(canReopenClosed(ago(8 * 24), now)).toBe(false);
  });
});
