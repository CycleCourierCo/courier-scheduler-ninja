import { describe, it, expect } from 'vitest';
import {
  confidenceOf, confidenceBand, outcomeForSimilarity, textSimilarity, decideAutoSend, canEnableLive, type AutoSendInput,
} from '../../supabase/functions/_shared/cannedConfidence';

const base: AutoSendInput = {
  text: 'where is my bike please', runnerUpScore: 0, channel: 'email', minsSinceStaffReply: null, lastOutboundWasAuto: false,
  top: { mode: 'live', blocked: false, uses: 40, confidence: 0.95, score: 5 },
};

describe('instant response confidence', () => {
  it('sent as is = 1, small edit = 0.5, rewritten/replaced = 0', () => {
    expect(confidenceOf(['as_is', 'edited', 'rewritten', 'replaced'])).toBe(0.375);
  });
  it('only the latest 50 decisions count', () => {
    expect(confidenceOf([...Array(50).fill('as_is'), ...Array(50).fill('rewritten')])).toBe(1);
  });
  it('needs 30 uses before a score is trusted', () => {
    expect(confidenceBand(29, 1)).toBe('learning');
    expect(confidenceBand(30, 0.9)).toBe('high');
    expect(confidenceBand(30, 0.89)).toBe('medium');
    expect(confidenceBand(30, 0.69)).toBe('low');
  });
  it('95%+ same words = as is, 60%+ = edited, else rewritten', () => {
    expect(outcomeForSimilarity(textSimilarity('Hi Sam your bike is on the way', 'Hi Sam your bike is on the way'))).toBe('as_is');
    expect(outcomeForSimilarity(0.7)).toBe('edited');
    expect(outcomeForSimilarity(0.5)).toBe('rewritten');
  });
  it('live auto-send needs 30 uses and 90% and not blocked', () => {
    expect(canEnableLive(30, 0.9, false)).toBe(true);
    expect(canEnableLive(29, 1, false)).toBe(false);
    expect(canEnableLive(40, 0.89, false)).toBe(false);
    expect(canEnableLive(40, 1, true)).toBe(false);
  });
  it('sends only on a confident, strong, unambiguous match', () => {
    expect(decideAutoSend(base).action).toBe('send');
    expect(decideAutoSend({ ...base, top: { ...base.top!, score: 3 } }).action).toBe('none');
    expect(decideAutoSend({ ...base, runnerUpScore: 4 }).action).toBe('none');
  });
  it('never auto-sends on sensitive wording', () => {
    expect(decideAutoSend({ ...base, text: 'where is my bike, I want a refund' }).action).toBe('none');
    expect(decideAutoSend({ ...base, text: 'my bike arrived damaged' }).action).toBe('none');
  });
  it('never twice in a row, or within an hour of a staff reply', () => {
    expect(decideAutoSend({ ...base, lastOutboundWasAuto: true }).action).toBe('none');
    expect(decideAutoSend({ ...base, minsSinceStaffReply: 59 }).action).toBe('none');
    expect(decideAutoSend({ ...base, minsSinceStaffReply: 61 }).action).toBe('send');
  });
  it('trial mode logs without sending', () => {
    expect(decideAutoSend({ ...base, top: { ...base.top!, mode: 'trial', uses: 0, confidence: null } }).action).toBe('trial');
  });
});
