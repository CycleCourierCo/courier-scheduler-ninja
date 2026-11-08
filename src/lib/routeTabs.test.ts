import { describe, it, expect } from 'vitest';
import { routeTabUrl, parseRouteTabParams } from './routeTabs';

describe('route tabs', () => {
  it('a new route tab carries the route day and start time and opens Get Timeslots', () => {
    const url = routeTabUrl({ jobs: [{ orderId: 'a1', type: 'pickup' }], routeDate: '2026-11-12', startTime: '08:30' });
    const p = parseRouteTabParams(url.split('?')[1]);
    expect(p).toEqual({ routeDate: '2026-11-12', startTime: '08:30', openTimeslots: true, stashKey: null });
    expect(url).toContain('jobs=a1:pickup');
  });

  it('ignores a malformed date or time instead of picking a wrong day', () => {
    const p = parseRouteTabParams('routeDate=12-11-2026&start=25:00&timeslots=1');
    expect(p.routeDate).toBeNull();
    expect(p.startTime).toBeNull();
  });
});
