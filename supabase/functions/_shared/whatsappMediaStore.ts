// Downloads WhatsApp media sent by customers (via SendZen) and stores it privately in cs-attachments.
const SENDZEN = 'https://api.sendzen.io';
const MAX_BYTES = 100 * 1024 * 1024;

async function fetchBytes(url: string, apiKey: string | undefined): Promise<{ bytes: Uint8Array; type: string } | null> {
  const res = await fetch(url, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} });
  if (!res.ok) { console.warn(`media download attempt failed: ${res.status}`); await res.body?.cancel(); return null; }
  const type = (res.headers.get('content-type') || '').split(';')[0];
  if (type.includes('json')) {
    const j = await res.json().catch(() => null);
    const next = j?.url || j?.data?.url || j?.link;
    return next && next !== url ? fetchBytes(next, apiKey) : null;
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (!buf.length || buf.length > MAX_BYTES) return null;
  return { bytes: buf, type };
}

let cachedPid: string | undefined;
/** Reads our WhatsApp phone number ID from SendZen's account list (matches SENDZEN_WABA_ID when set). */
async function lookupPhoneNumberId(apiKey: string | undefined): Promise<string | undefined> {
  if (cachedPid || !apiKey) return cachedPid;
  try {
    const res = await fetch(`${SENDZEN}/v1/waba`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) { await res.body?.cancel(); return undefined; }
    const j = await res.json();
    const wabas = (j?.projects || []).flatMap((p: any) => p?.wabas || []);
    const want = Deno.env.get('SENDZEN_WABA_ID');
    const hit = wabas.find((w: any) => want && w?.waba_id === want) || wabas.find((w: any) => w?.phone_number_id);
    cachedPid = hit?.phone_number_id ? String(hit.phone_number_id) : undefined;
  } catch { /* ignore */ }
  return cachedPid;
}

export async function downloadWhatsAppMedia(
  admin: any,
  conversationId: string,
  att: { url?: string; media_id?: string; phone_number_id?: string; filename: string; content_type: string },
  phoneNumberId?: string,
): Promise<{ url: string; path: string; size: number } | null> {
  const apiKey = Deno.env.get('SENDZEN_API_KEY');
  const candidates: string[] = [];
  const pid = att.phone_number_id || phoneNumberId || Deno.env.get('SENDZEN_PHONE_NUMBER_ID') || await lookupPhoneNumberId(apiKey);
  // SendZen's documented proxy: GET /v1/{phoneNumberId}/media?url=<Meta media URL>
  if (pid && att.url && /^https:\/\//.test(att.url)) {
    candidates.push(`${SENDZEN}/v1/${encodeURIComponent(pid)}/media?url=${encodeURIComponent(att.url)}`);
  }
  if (att.media_id) {
    candidates.push(`${SENDZEN}/v1/media/${encodeURIComponent(att.media_id)}`);
    if (pid) candidates.push(`${SENDZEN}/v1/${pid}/media/${encodeURIComponent(att.media_id)}`);
  }
  if (att.url && /^https:\/\//.test(att.url)) candidates.push(att.url);

  for (const u of candidates) {
    try {
      const got = await fetchBytes(u, apiKey);
      if (!got) continue;
      const safe = att.filename.normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80) || 'file';
      const path = `${conversationId}/wa-in/${crypto.randomUUID()}-${safe}`;
      const { error } = await admin.storage.from('cs-attachments').upload(path, got.bytes, {
        contentType: att.content_type || got.type || 'application/octet-stream',
      });
      if (error) continue;
      const { data: signed } = await admin.storage.from('cs-attachments').createSignedUrl(path, 60 * 60 * 24 * 365);
      if (!signed?.signedUrl) continue;
      return { url: signed.signedUrl, path, size: got.bytes.length };
    } catch { /* try next */ }
  }
  return null;
}

/** Finds metadata.phone_number_id anywhere in a webhook payload. */
export function findPhoneNumberId(v: any, depth = 0): string | undefined {
  if (!v || typeof v !== 'object' || depth > 8) return undefined;
  for (const k of ['phone_number_id', 'phoneNumberId']) if (v[k]) return String(v[k]);
  for (const x of Object.values(v)) { const r = findPhoneNumberId(x, depth + 1); if (r) return r; }
  return undefined;
}
