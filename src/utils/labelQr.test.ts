import { describe, expect, it } from 'vitest';
import { labelTrackingUrl, createLabelQr } from './labelQr';

describe('label tracking QR', () => {
  it('opens the existing tracking page until signed-in destinations are decided', () => {
    expect(labelTrackingUrl('CCC754270869446ANDLE6')).toBe(
      'https://booking.cyclecourierco.com/tracking/CCC754270869446ANDLE6',
    );
  });
  it('encodes a reference as a single path segment', () => {
    expect(labelTrackingUrl('A/B?x=1')).toBe('https://booking.cyclecourierco.com/tracking/A%2FB%3Fx%3D1');
  });
  it('keeps a normal tracking QR within the label allocation at three printer dots per module', () => {
    const code = createLabelQr('CCC754270869446ANDLE6');
    expect((code.getModuleCount() + 8) * 3 * 72 / 203).toBeLessThanOrEqual(74);
  });
});