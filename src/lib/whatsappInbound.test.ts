import { describe, it, expect } from 'vitest';
import { parseWhatsAppWebhook, nextDeliveryStatus } from '../../supabase/functions/_shared/whatsappInbound';

describe('WhatsApp inbound parser', () => {
  it('reads Meta-style messages with contact name', () => {
    const r = parseWhatsAppWebhook({ entry: [{ changes: [{ value: {
      contacts: [{ wa_id: '447700900123', profile: { name: 'Sam' } }],
      messages: [{ from: '447700900123', id: 'wamid.1', type: 'text', text: { body: 'Hi' } }],
    } }] }] });
    expect(r.messages).toEqual([{ from: '447700900123', name: 'Sam', externalId: 'wamid.1', text: 'Hi', attachment: null }]);
  });
  it('still reads the old flat shape', () => {
    expect(parseWhatsAppWebhook({ from: '447700900123', text: 'Hello', id: 'x' }).messages[0].text).toBe('Hello');
  });
  it('labels photos and keeps the caption', () => {
    const r = parseWhatsAppWebhook({ messages: [{ from: '44', id: 'a', type: 'image', image: { caption: 'Damage', link: 'https://x/y.jpg' } }] });
    expect(r.messages[0].text).toBe('[Photo] Damage');
    expect(r.messages[0].attachment?.url).toBe('https://x/y.jpg');
  });
  it('reads delivery status events', () => {
    const r = parseWhatsAppWebhook({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.9', status: 'read' }] } }] }] });
    expect(r.statuses).toEqual([{ externalId: 'wamid.9', status: 'read', error: null }]);
  });
  it('never moves a read reply back to delivered', () => {
    expect(nextDeliveryStatus('read', 'delivered')).toBe('read');
    expect(nextDeliveryStatus('sent', 'failed')).toBe('failed');
  });
});
