// WhatsApp media rules (Meta Cloud API limits). No imports so the browser and Vitest share it.
export type WaMediaKind = 'image' | 'video' | 'audio' | 'document' | 'sticker';

const MB = 1024 * 1024;
export const WA_MEDIA_LIMITS: Record<WaMediaKind, number> = {
  image: 5 * MB, video: 16 * MB, audio: 16 * MB, document: 100 * MB, sticker: 0.5 * MB,
};

const IMAGE = ['image/jpeg', 'image/png'];
const VIDEO = ['video/mp4', 'video/3gpp'];

/** Which WhatsApp message type a file goes out as; other image/video formats are sent as documents. */
export function waMediaKindFor(contentType: string): WaMediaKind {
  const t = (contentType || '').toLowerCase().split(';')[0].trim();
  if (IMAGE.includes(t)) return 'image';
  if (VIDEO.includes(t)) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  return 'document';
}

/** Returns an error message when a file is too big for WhatsApp, else null. */
export function waMediaSizeError(contentType: string, size: number): string | null {
  const kind = waMediaKindFor(contentType);
  const limit = WA_MEDIA_LIMITS[kind];
  return size > limit ? `${kind === 'document' ? 'Documents' : kind[0].toUpperCase() + kind.slice(1) + 's'} must be under ${Math.round(limit / MB)}MB on WhatsApp` : null;
}

/** Audio and stickers can't carry a caption on WhatsApp. */
export function waKindTakesCaption(kind: WaMediaKind): boolean {
  return kind === 'image' || kind === 'video' || kind === 'document';
}

export function formatCallDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}
