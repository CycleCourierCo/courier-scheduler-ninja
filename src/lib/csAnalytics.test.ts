import { describe, it, expect } from 'vitest';
import { analyseConversation, classifyTopic, isStaffReply, type CsConv, type CsMsg } from './csAnalytics';

const conv: CsConv = { id: 'c', channel: 'whatsapp', status: 'closed', priority: 'normal', queue_id: null, assignee_id: 'a',
  created_at: '2026-10-29T09:00:00Z', closed_at: '2026-10-29T11:00:00Z', first_response_due_at: '2026-10-29T10:00:00Z', linked_order_id: null, subject: null };
const msg = (p: Partial<CsMsg>): CsMsg => ({ conversation_id: 'c', direction: 'in', author_id: null, created_at: '2026-10-29T09:00:00Z',
  is_automatic: false, system_event: null, delivery_status: null, sent_via: null, body_text: '', status: 'received', ...p });

describe('cs analytics', () => {
  it('automatic acknowledgements do not count as the first response', () => {
    const s = analyseConversation(conv, [
      msg({ body_text: 'where is my bike' }),
      msg({ direction: 'out', is_automatic: true, created_at: '2026-10-29T09:01:00Z', status: 'sent' }),
      msg({ direction: 'out', author_id: 'a', created_at: '2026-10-29T09:30:00Z', status: 'sent' }),
    ]);
    expect(s.firstResponseMins).toBe(30);
    expect(s.firstResponder).toBe('a');
    expect(s.slaMet).toBe(true);
    expect(s.resolutionMins).toBe(120);
  });
  it('internal notes are not staff replies', () => {
    expect(isStaffReply(msg({ direction: 'note', author_id: 'a' }))).toBe(false);
  });
  it('classifies damage before tracking', () => {
    expect(classifyTopic('where is my bike, it arrived damaged')).toBe('damage');
    expect(classifyTopic('hello')).toBe('other');
  });
});
