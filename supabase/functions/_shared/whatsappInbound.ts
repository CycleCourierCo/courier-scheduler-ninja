// Parses SendZen / Meta-style WhatsApp webhook payloads. No imports so Vitest can test it.

export interface InboundWaMessage {
  from: string;
  name: string | null;
  externalId: string | null;
  text: string;
  attachment: { url: string; filename: string; content_type: string } | null;
}

export interface WaStatusUpdate {
  externalId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  error: string | null;
}

const MEDIA_LABEL: Record<string, string> = {
  image: '[Photo]', video: '[Video]', audio: '[Voice note]', voice: '[Voice note]',
  document: '[Document]', sticker: '[Sticker]',
};

function describe(m: any): { text: string; attachment: InboundWaMessage['attachment'] } {
  const type = m?.type || (m?.text ? 'text' : '');
  if (typeof m?.text === 'string') return { text: m.text, attachment: null };
  if (m?.text?.body) return { text: String(m.text.body), attachment: null };
  if (MEDIA_LABEL[type]) {
    const media = m[type] || {};
    const caption = media.caption ? ` ${media.caption}` : '';
    const url = media.link || media.url || '';
    return {
      text: `${MEDIA_LABEL[type]}${caption}`,
      attachment: url ? {
        url, filename: media.filename || `${type}`,
        content_type: media.mime_type || (type === 'image' ? 'image/jpeg' : 'application/octet-stream'),
      } : null,
    };
  }
  if (type === 'location' && m.location) {
    const l = m.location;
    return { text: `[Location] ${l.name ? l.name + ' ' : ''}https://maps.google.com/?q=${l.latitude},${l.longitude}`, attachment: null };
  }
  if (type === 'button') return { text: String(m.button?.text || m.button?.payload || '[Button reply]'), attachment: null };
  if (type === 'interactive') {
    const i = m.interactive || {};
    return { text: String(i.button_reply?.title || i.list_reply?.title || '[Reply]'), attachment: null };
  }
  if (type === 'reaction') return { text: `[Reaction] ${m.reaction?.emoji || ''}`.trim(), attachment: null };
  if (type) return { text: `[${type}]`, attachment: null };
  return { text: '', attachment: null };
}

const STATUS_MAP: Record<string, WaStatusUpdate['status']> = {
  sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed', undelivered: 'failed',
};

export function parseWhatsAppWebhook(body: any): { messages: InboundWaMessage[]; statuses: WaStatusUpdate[] } {
  const messages: InboundWaMessage[] = [];
  const statuses: WaStatusUpdate[] = [];
  const values: any[] = [];
  for (const e of Array.isArray(body?.entry) ? body.entry : []) {
    for (const c of Array.isArray(e?.changes) ? e.changes : []) if (c?.value) values.push(c.value);
  }
  if (body?.value) values.push(body.value);
  if (body?.data && (body.data.messages || body.data.statuses)) values.push(body.data);
  if (body?.messages || body?.statuses) values.push(body);

  for (const v of values) {
    const names: Record<string, string> = {};
    for (const c of Array.isArray(v.contacts) ? v.contacts : []) {
      if (c?.wa_id) names[c.wa_id] = c.profile?.name;
    }
    for (const m of Array.isArray(v.messages) ? v.messages : []) {
      const d = describe(m);
      if (!m?.from || !d.text) continue;
      messages.push({ from: String(m.from), name: names[m.from] || null, externalId: m.id || null, ...d });
    }
    for (const s of Array.isArray(v.statuses) ? v.statuses : []) {
      const st = STATUS_MAP[String(s?.status || '').toLowerCase()];
      if (!s?.id || !st) continue;
      const err = Array.isArray(s.errors) && s.errors[0]
        ? String(s.errors[0].title || s.errors[0].message || s.errors[0].code) : null;
      statuses.push({ externalId: String(s.id), status: st, error: err });
    }
  }

  if (!values.length) {
    // Legacy flat shape
    const from = body?.from || body?.sender || body?.wa_id || body?.message?.from || '';
    const d = body?.message && typeof body.message === 'object' && !body.text && !body.body
      ? describe(body.message)
      : { text: String(body?.text || body?.body || ''), attachment: null };
    if (from && d.text) {
      messages.push({
        from: String(from), name: body.profile_name || body.contact?.profile?.name || body.from_name || null,
        externalId: body.message_id || body.id || body.message?.id || null, ...d,
      });
    }
  }
  return { messages, statuses };
}

export function normaliseWaHandle(from: string): string {
  return String(from).replace(/[^\d+]/g, '').replace(/^00/, '+');
}

const RANK = { sent: 1, delivered: 2, read: 3, failed: 0 } as const;
/** A status update never moves a message backwards (read stays read), except to failed from sent. */
export function nextDeliveryStatus(current: string | null, incoming: WaStatusUpdate['status']): string {
  if (incoming === 'failed') return current === 'delivered' || current === 'read' ? current : 'failed';
  const cur = (RANK as any)[current ?? ''] ?? 0;
  return RANK[incoming] >= cur ? incoming : (current as string);
}
