// Instant-response matching, confidence and auto-send rules. No imports, so the app, the
// Edge Functions and Vitest all use exactly the same rules.

export interface MatchableResponse {
  id: string; keywords: string[] | null; is_active: boolean; sort_order: number;
}

export const normaliseText = (s: string) =>
  (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Keyword/phrase hits; longer phrases count more. Highest first. */
export function scoreResponses<T extends MatchableResponse>(text: string | null | undefined, responses: T[]) {
  const hay = ` ${normaliseText(text || '')} `;
  if (hay.trim().length < 3) return [] as { response: T; score: number }[];
  return responses
    .filter((r) => r.is_active && (r.keywords?.length ?? 0) > 0)
    .map((r) => {
      let score = 0;
      for (const raw of r.keywords || []) {
        const kw = normaliseText(raw || '');
        if (kw && hay.includes(` ${kw} `)) score += 1 + kw.split(' ').length;
      }
      return { response: r, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.response.sort_order - b.response.sort_order);
}

/** Word-overlap similarity (0–1) between the filled-in response and what was actually sent. */
export function textSimilarity(a: string, b: string): number {
  const wa = normaliseText(a).split(' ').filter(Boolean);
  const wb = normaliseText(b).split(' ').filter(Boolean);
  if (!wa.length && !wb.length) return 1;
  if (!wa.length || !wb.length) return 0;
  const counts = new Map<string, number>();
  for (const w of wa) counts.set(w, (counts.get(w) ?? 0) + 1);
  let common = 0;
  for (const w of wb) { const c = counts.get(w) ?? 0; if (c > 0) { common++; counts.set(w, c - 1); } }
  return (2 * common) / (wa.length + wb.length);
}

export type StaffOutcome = 'as_is' | 'edited' | 'rewritten' | 'replaced';

export function outcomeForSimilarity(sim: number): Exclude<StaffOutcome, 'replaced'> {
  if (sim >= 0.95) return 'as_is';
  if (sim >= 0.6) return 'edited';
  return 'rewritten';
}

export const MIN_USES = 30;
export const WINDOW = 50;
export const LIVE_THRESHOLD = 0.9;
export const DISABLE_THRESHOLD = 0.85;
export const STRONG_MATCH = 4;
export const AMBIGUOUS_RATIO = 0.8;

const WEIGHT: Record<StaffOutcome, number> = { as_is: 1, edited: 0.5, rewritten: 0, replaced: 0 };

/** Outcomes newest first; uses the latest WINDOW decisions. */
export function confidenceOf(outcomes: StaffOutcome[]): number | null {
  const recent = outcomes.slice(0, WINDOW);
  if (!recent.length) return null;
  return recent.reduce((s, o) => s + WEIGHT[o], 0) / recent.length;
}

export type Band = 'learning' | 'high' | 'medium' | 'low';
export function confidenceBand(uses: number, confidence: number | null): Band {
  if (uses < MIN_USES || confidence == null) return 'learning';
  if (confidence >= LIVE_THRESHOLD) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}

export const canEnableLive = (uses: number, confidence: number | null, blocked: boolean) =>
  !blocked && uses >= MIN_USES && (confidence ?? 0) >= LIVE_THRESHOLD;

export const SENSITIVE = /\b(refund\w*|damage\w*|broken|scratch\w*|bent|crack\w*|solicitor\w*|lawyer\w*|legal|court|complain\w*|complaint|cancel\w*|dispute\w*|chargeback|police|stolen|theft|missing|lost|furious|unacceptable|disgust\w*|compensat\w*|claim\w*)\b/i;

export interface AutoSendInput {
  text: string;
  top: { mode: string; blocked: boolean; uses: number; confidence: number | null; score: number } | null;
  runnerUpScore: number;
  channel: string;
  /** Minutes since the last message on the ticket written by a person on our side, null if none. */
  minsSinceStaffReply: number | null;
  /** True when our most recent outbound message on this ticket was an auto-reply. */
  lastOutboundWasAuto: boolean;
  hasAttachmentOnly?: boolean;
}

export type AutoSendDecision = { action: 'none' | 'trial' | 'send'; reason: string };

export function decideAutoSend(i: AutoSendInput): AutoSendDecision {
  const t = i.top;
  if (!t || t.mode === 'off') return { action: 'none', reason: 'not enabled' };
  if (t.blocked) return { action: 'none', reason: 'response is never auto-sent' };
  if (!i.text.trim() || i.hasAttachmentOnly) return { action: 'none', reason: 'no text to match' };
  if (SENSITIVE.test(i.text)) return { action: 'none', reason: 'sensitive wording' };
  if (t.score < STRONG_MATCH) return { action: 'none', reason: 'weak match' };
  if (i.runnerUpScore > 0 && i.runnerUpScore >= t.score * AMBIGUOUS_RATIO) return { action: 'none', reason: 'ambiguous match' };
  if (i.lastOutboundWasAuto) return { action: 'none', reason: 'already auto-replied' };
  if (i.minsSinceStaffReply != null && i.minsSinceStaffReply < 60) return { action: 'none', reason: 'staff replied recently' };
  if (t.mode === 'trial') return { action: 'trial', reason: 'trial' };
  if (t.mode !== 'live') return { action: 'none', reason: 'not enabled' };
  if (!canEnableLive(t.uses, t.confidence, t.blocked) || (t.confidence ?? 0) < DISABLE_THRESHOLD) {
    return { action: 'none', reason: 'confidence too low' };
  }
  return { action: 'send', reason: 'confident match' };
}
