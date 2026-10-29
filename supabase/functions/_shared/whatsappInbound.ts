// Parses SendZen / Meta-style WhatsApp webhook payloads. No imports from outside _shared so Vitest can test it.
import { formatCallDuration } from './whatsappMedia.ts';

export interface InboundWaAttachment {
  url: string;
  filename: string;
  content_type: string;
  kind?: string;
  media_id?: string;
}

export interface InboundWaMessage {
  from: string;
  name: string | null;
  externalId: string | null;
  text: string;
  attachment: InboundWaAttachment | null;
  /** WhatsApp message ID this message replies to or reacts to. */
  replyTo?: string | null;
  isReaction?: boolean;
  isCall?: boolean;
}

export interface WaStatusUpdate {
  externalId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  error: string | null;
}

const MEDIA_LABEL: Record<string, string> = {
  image: '[Photo]', video: '[Video]', audio: '[Audio]', voice: '[Voice note]',
  document: '[Document]', sticker: '[Sticker]',
};

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/3gpp': '3gp',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr',
  'application/pdf': 'pdf',
};

function describe(m: any): Omit<InboundWaMessage, 'from' | 'name' | 'externalId'> {
  const type = m?.type || (m?.text ? 'text' : '');
  const replyTo = m?.context?.id || null;
  if (typeof m?.text === 'string') return { text: m.text, attachment: null, replyTo };
  if (m?.text?.body) return { text: String(m.text.body), attachment: null, replyTo };
  if (MEDIA_LABEL[type]) {
    const media = m[type] || {};
    const isVoice = type === 'audio' && media.voice === true;
    const label = isVoice ? MEDIA_LABEL.voice : MEDIA_LABEL[type];
    const caption = media.caption ? ` ${media.caption}` : '';
    const mime = String(media.mime_type || (type === 'image' ? 'image/jpeg' : type === 'sticker' ? 'image/webp' : 'application/octet-stream')).split(';')[0];
    const url = media.link || media.url || '';
    const filename = media.filename || `${isVoice ? 'voice-note' : type}.${EXT[mime] || 'bin'}`;
    return {
      text: `${label}${caption}`,
      attachment: url || media.id ? { url, filename, content_type: mime, kind: type, ...(media.id ? { media_id: String(media.id) } : {}) } : null,
      replyTo,
    };
  }
  if (type === 'location' && m.location) {
    const l = m.location;
    const name = [l.name, l.address].filter(Boolean).join(', ');
    return { text: `[Location] ${name ? name + ' ' : ''}https://maps.google.com/?q=${l.latitude},${l.longitude}`, attachment: null, replyTo };
  }
  if (type === 'contacts' && Array.isArray(m.contacts)) {
    const cards = m.contacts.map((c: any) => {
      const nm = c.name?.formatted_name || [c.name?.first_name, c.name?.last_name].filter(Boolean).join(' ') || 'Contact';
      const phones = (c.phones || []).map((p: any) => p.phone).filter(Boolean).join(', ');
      return `${nm}${phones ? ` (${phones})` : ''}`;
    });
    return { text: `[Contact card] ${cards.join('; ')}`, attachment: null, replyTo };
  }
  if (type === 'button') return { text: String(m.button?.text || m.button?.payload || '[Button reply]'), attachment: null, replyTo };
  if (type === 'interactive') {
    const i = m.interactive || {};
    return { text: String(i.button_reply?.title || i.list_reply?.title || '[Reply]'), attachment: null, replyTo };
  }
  if (type === 'reaction') {
    const emoji = m.reaction?.emoji;
    return { text: emoji ? `Reacted ${emoji}` : 'Removed a reaction', attachment: null, replyTo: m.reaction?.message_id || null, isReaction: true };
  }
  if (type === 'unsupported' || type) return { text: `[Unsupported WhatsApp message${type && type !== 'unsupported' ? `: ${type}` : ''}]`, attachment: null, replyTo };
  return { text: '', attachment: null, replyTo };
}

/** WhatsApp calling webhooks: only the final event of a call is recorded, so each call shows once. */
function describeCall(c: any): InboundWaMessage | null {
  const event = String(c?.event || '').toLowerCase();
  const status = String(c?.status || '').toLowerCase();
  if (!c?.id || !c?.from) return null;
  if (event && event !== 'terminate') return null;
  if (String(c.direction || '').toUpperCase() === 'BUSINESS_INITIATED') return null;
  const duration = Number(c.duration ?? 0);
  const answered = duration > 0 || status === 'completed';
  return {
    from: String(c.from), name: null, externalId: `call:${c.id}`,
    text: answered && duration > 0 ? `📞 WhatsApp call · ${formatCallDuration(duration)}` : '📞 Missed WhatsApp call',
    attachment: null, isCall: true,
  };
}

const STATUS_MAP: Record<string, WaStatusUpdate['status']> = {
  sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed', undelivered: 'failed',
};

export interface WaEcho extends Omit<InboundWaMessage, 'from' | 'name'> {
  /** Customer number the business messaged from the WhatsApp Business phone app. */
  to: string;
}

export function parseWhatsAppWebhook(body: any): { messages: InboundWaMessage[]; statuses: WaStatusUpdate[]; echoes: WaEcho[] } {
  const echoes: WaEcho[] = [];
  const messages: InboundWaMessage[] = [];
  const statuses: WaStatusUpdate[] = [];
  const values: any[] = [];
  for (const e of Array.isArray(body?.entry) ? body.entry : []) {
    for (const c of Array.isArray(e?.changes) ? e.changes : []) if (c?.value) values.push(c.value);
  }
  if (body?.value) values.push(body.value);
  if (body?.data && (body.data.messages || body.data.statuses || body.data.calls || body.data.message_echoes)) values.push(body.data);
  if (body?.messages || body?.statuses || body?.calls || body?.message_echoes) values.push(body);

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
    for (const m of Array.isArray(v.message_echoes) ? v.message_echoes : []) {
      const d = describe(m);
      if (!m?.to || !d.text) continue;
      echoes.push({ to: String(m.to), externalId: m.id || null, ...d });
    }
    for (const c of Array.isArray(v.calls) ? v.calls : []) {
      const call = describeCall(c);
      if (call) messages.push({ ...call, name: names[call.from] || null });
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
  return { messages, statuses, echoes };
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
