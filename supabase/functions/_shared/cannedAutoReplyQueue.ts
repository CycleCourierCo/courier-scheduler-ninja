/** Hand a just-saved customer message to cs-auto-reply in the background; never blocks or fails the webhook. */
export function queueCannedAutoReply(conversationId: string, messageId: string) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key || !conversationId || !messageId) return;
  const p = fetch(`${url}/functions/v1/cs-auto-reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ conversation_id: conversationId, message_id: messageId }),
  }).then((r) => r.text()).catch((e) => console.error('auto-reply queue failed:', e?.message));
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
}
