// Mirrors an automated outbound WhatsApp (timeslots, reviews, date chasers) into the
// customer's Customer Service Inbox thread so staff see what we sent before a reply.
// Never throws: inbox logging must not break the send itself.

export function waProviderId(respText: string): string | null {
  try {
    const j = JSON.parse(respText);
    return j?.messages?.[0]?.id || j?.data?.messages?.[0]?.id || j?.id || j?.message_id || j?.data?.id || null;
  } catch { return null; }
}

export async function mirrorWhatsAppOutbound(admin: any, opts: {
  phone: string; text: string; ok: boolean; respText?: string; orderId?: string | null; name?: string | null;
}) {
  try {
    let d = String(opts.phone || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    else if (d.startsWith('0')) d = `44${d.slice(1)}`;
    if (d.length < 8) return;
    const { data: existing } = await admin.from('cs_contacts').select('id')
      .eq('channel', 'whatsapp').in('handle', [d, `+${d}`]).limit(1).maybeSingle();
    let contactId = existing?.id;
    if (!contactId) {
      const { data: c, error } = await admin.from('cs_contacts')
        .upsert({ channel: 'whatsapp', handle: d, ...(opts.name ? { display_name: opts.name } : {}) }, { onConflict: 'channel,handle' })
        .select('id').single();
      if (error) return;
      contactId = c.id;
    }
    const now = new Date().toISOString();
    const preview = opts.text.slice(0, 140);
    const { data: conv } = await admin.from('cs_conversations').select('id')
      .eq('contact_id', contactId).eq('channel', 'whatsapp').neq('status', 'closed')
      .order('last_message_at', { ascending: false }).limit(1).maybeSingle();
    let convId = conv?.id;
    if (convId) {
      await admin.from('cs_conversations').update({ last_message_at: now, last_message_preview: preview }).eq('id', convId);
    } else {
      // Automated sends start as 'pending' so they don't crowd the open queue; a reply reopens it.
      const { data: created } = await admin.from('cs_conversations').insert({
        channel: 'whatsapp', contact_id: contactId, status: 'pending',
        last_message_at: now, last_message_preview: preview, unread_count: 0,
        ...(opts.orderId ? { linked_order_id: opts.orderId } : {}),
      }).select('id').single();
      convId = created?.id;
    }
    if (!convId) return;
    const ext = opts.ok && opts.respText ? waProviderId(opts.respText) : null;
    await admin.from('cs_messages').insert({
      conversation_id: convId, direction: 'out', author_id: null, body_text: opts.text,
      external_id: ext, provider_message_id: ext,
      delivery_status: opts.ok ? 'sent' : 'failed', status: opts.ok ? 'sent' : 'failed',
      error: opts.ok ? null : String(opts.respText || 'send failed').slice(0, 300),
    });
  } catch (e) {
    console.error('mirrorWhatsAppOutbound failed:', (e as Error)?.message);
  }
}
