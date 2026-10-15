// Shared Divergent Connect SMS sender. Every customer SMS goes through here so
// sender name, 160-char limit, link shortening and logging stay consistent.
const API = "https://api.connect.ms/v2/sms";
export const SMS_SENDER = "CycleCourie";
const LINK_LEN = 25; // shortened dv.gt links are 25 chars

export function toE164(phone: string | null | undefined): string | null {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length < 8) return null;
  if (d.startsWith("00")) return `+${d.slice(2)}`;
  if (d.startsWith("0")) return `+44${d.slice(1)}`;
  return `+${d}`;
}

const mask = (p: string) => `${p.slice(0, 5)}***${p.slice(-2)}`;

/** Fit text + link into one 160-char GSM part, trimming the text if needed. */
export function fitSms(text: string, link?: string): string {
  const clean = text.replace(/[’‘]/g, "'").replace(/[–—]/g, "-");
  const room = 160 - (link ? LINK_LEN + 1 : 0);
  const body = clean.length > room ? clean.slice(0, room - 3).trimEnd() + "..." : clean;
  return link ? `${body} ${link}` : body;
}

export async function sendSms(
  admin: any,
  opts: { phone: string | null | undefined; content: string; orderId?: string; type: string; side?: string; idempotencyKey: string },
): Promise<{ ok: boolean; error?: string }> {
  const key = Deno.env.get("DIVERGENT_API_KEY");
  if (!key) return { ok: false, error: "SMS not configured" };
  const recipient = toE164(opts.phone);
  if (!recipient) return { ok: false, error: "no phone" };
  let providerId: string | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": opts.idempotencyKey.slice(0, 200) },
      body: JSON.stringify({
        sender: SMS_SENDER,
        recipient,
        content: opts.content,
        kind: "transactional",
        unicode: "strip",
        clientReference: opts.orderId ? `${opts.type}:${opts.orderId}` : opts.type,
      }),
    });
    const txt = await res.text();
    if (res.ok) {
      try { providerId = JSON.parse(txt)?.id ?? null; } catch { /* ignore */ }
    } else {
      error = `[${res.status}] ${txt.slice(0, 300)}`;
      console.error(`SMS send failed (${opts.type}): ${error}`);
    }
  } catch (e) {
    error = String((e as Error).message).slice(0, 300);
  }
  await admin.from("sms_messages").insert({
    order_id: opts.orderId ?? null, recipient_masked: mask(recipient), type: opts.type, side: opts.side ?? null,
    provider_id: providerId, status: error ? "failed" : "sent", error,
  });
  return error ? { ok: false, error } : { ok: true };
}
