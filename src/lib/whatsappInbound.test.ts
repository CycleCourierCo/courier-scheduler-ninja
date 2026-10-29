import { describe, it, expect } from 'vitest';
import { parseWhatsAppWebhook, nextDeliveryStatus } from '../../supabase/functions/_shared/whatsappInbound';

describe('WhatsApp inbound parser', () => {
  it('reads Meta-style messages with contact name', () => {
    const r = parseWhatsAppWebhook({ entry: [{ changes: [{ value: {
      contacts: [{ wa_id: '447700900123', profile: { name: 'Sam' } }],
      messages: [{ from: '447700900123', id: 'wamid.1', type: 'text', text: { body: 'Hi' } }],
    } }] }] });
    expect(r.messages).toEqual([{ from: '447700900123', name: 'Sam', externalId: 'wamid.1', text: 'Hi', attachment: null, replyTo: null }]);
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

import { waMediaKindFor, waMediaSizeError } from '../../supabase/functions/_shared/whatsappMedia';

describe('WhatsApp media and calls', () => {
  it('keeps the media ID so the file can be downloaded', () => {
    const r = parseWhatsAppWebhook({ messages: [{ from: '44', id: 'b', type: 'audio', audio: { id: 'MID1', mime_type: 'audio/ogg; codecs=opus', voice: true } }] });
    expect(r.messages[0].text).toBe('[Voice note]');
    expect(r.messages[0].attachment).toMatchObject({ media_id: 'MID1', content_type: 'audio/ogg', filename: 'voice-note.ogg' });
  });
  it('records a missed call once, on the final call event', () => {
    const r = parseWhatsAppWebhook({ calls: [
      { id: 'c1', from: '44', event: 'connect' },
      { id: 'c1', from: '44', event: 'terminate', status: 'FAILED', duration: 0 },
    ] });
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0]).toMatchObject({ externalId: 'call:c1', text: '📞 Missed WhatsApp call', isCall: true });
  });
  it('shows answered call length', () => {
    const r = parseWhatsAppWebhook({ calls: [{ id: 'c2', from: '44', event: 'terminate', status: 'COMPLETED', duration: 192 }] });
    expect(r.messages[0].text).toBe('📞 WhatsApp call · 3m 12s');
  });
  it('links reactions and replies to the original message', () => {
    const r = parseWhatsAppWebhook({ messages: [
      { from: '44', id: 'r', type: 'reaction', reaction: { message_id: 'orig', emoji: '👍' } },
      { from: '44', id: 'q', type: 'text', text: { body: 'yes' }, context: { id: 'orig' } },
    ] });
    expect(r.messages[0]).toMatchObject({ isReaction: true, replyTo: 'orig', text: 'Reacted 👍' });
    expect(r.messages[1].replyTo).toBe('orig');
  });
  it('applies WhatsApp size limits per file type', () => {
    expect(waMediaKindFor('image/png')).toBe('image');
    expect(waMediaKindFor('image/heic')).toBe('document');
    expect(waMediaSizeError('image/jpeg', 6 * 1024 * 1024)).toMatch(/5MB/);
    expect(waMediaSizeError('application/pdf', 50 * 1024 * 1024)).toBeNull();
  });
});

describe('message echoes', () => {
  it('reads replies sent from the WhatsApp Business phone app', async () => {
    const { parseWhatsAppWebhook } = await import('../../supabase/functions/_shared/whatsappInbound');
    const r = parseWhatsAppWebhook({ entry: [{ changes: [{ field: 'smb_message_echoes', value: {
      message_echoes: [{ from: '447000000000', to: '447424750206', id: 'wamid.E1', type: 'text', text: { body: 'On our way' } }],
    } }] }] });
    expect(r.echoes).toEqual([expect.objectContaining({ to: '447424750206', externalId: 'wamid.E1', text: 'On our way' })]);
    expect(r.messages).toHaveLength(0);
  });
});
