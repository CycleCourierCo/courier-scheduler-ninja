// Shared helper: link a CS conversation to an order
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

export interface LinkResult {
  linked_order_id: string | null;
  suggested_order_ids: string[];
}

function normalizePhone(p: string): string {
  return p.replace(/[^\d]/g, '');
}

function extractTokens(text: string): string[] {
  if (!text) return [];
  // Tokens 4-30 chars alphanumeric with -/_ (order numbers, tracking codes)
  const matches = text.match(/[A-Za-z0-9][A-Za-z0-9_\-]{3,29}/g) || [];
  return Array.from(new Set(matches));
}

export async function resolveOrderLink(
  supabase: ReturnType<typeof createClient>,
  opts: { channel: 'email' | 'whatsapp'; handle: string; subject?: string; body?: string },
): Promise<LinkResult> {
  const text = `${opts.subject || ''} ${opts.body || ''}`;
  const tokens = extractTokens(text);

  // 1. Token match
  if (tokens.length) {
    const { data } = await supabase
      .from('orders')
      .select('id, tracking_number, customer_order_number, created_at')
      .or(
        tokens.flatMap(t => [
          `tracking_number.eq.${t}`,
          `customer_order_number.eq.${t}`,
        ]).join(',')
      )
      .limit(5);
    if (data && data.length === 1) {
      return { linked_order_id: data[0].id, suggested_order_ids: [] };
    }
    if (data && data.length > 1) {
      return { linked_order_id: null, suggested_order_ids: data.map((d: any) => d.id) };
    }
  }

  // 2. Contact match via sender/receiver JSONB
  let matches: any[] = [];
  if (opts.channel === 'email') {
    const handle = opts.handle.toLowerCase();
    const { data } = await supabase
      .from('orders')
      .select('id, created_at')
      .or(`sender->>email.ilike.${handle},receiver->>email.ilike.${handle}`)
      .order('created_at', { ascending: false })
      .limit(5);
    matches = data || [];
  } else {
    const norm = normalizePhone(opts.handle);
    if (norm.length >= 7) {
      // Match last 10 digits to handle +44 vs 0 prefixes
      const tail = norm.slice(-10);
      const { data } = await supabase
        .from('orders')
        .select('id, created_at, sender, receiver')
        .or(`sender->>phone.ilike.%${tail},receiver->>phone.ilike.%${tail}`)
        .order('created_at', { ascending: false })
        .limit(5);
      matches = data || [];
    }
  }

  if (matches.length === 1) {
    return { linked_order_id: matches[0].id, suggested_order_ids: [] };
  }
  if (matches.length > 1) {
    return { linked_order_id: null, suggested_order_ids: matches.map(m => m.id) };
  }
  return { linked_order_id: null, suggested_order_ids: [] };
}
