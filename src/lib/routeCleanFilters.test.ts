import { describe, it, expect } from 'vitest';
import { isRemovableUncollectedDelivery, isRemovableNotCustomerDate } from './routeCleanFilters';

const route = new Date(2026, 10, 9); // Mon 9 Nov 2026
const delivery = (orderData: any = {}) => ({ orderId: 'o1', type: 'delivery', orderData });

describe('Remove not collected', () => {
  it('keeps a delivery whose bike is collected earlier on the same route', () => {
    const d = delivery();
    expect(isRemovableUncollectedDelivery(d, [{ orderId: 'o1', type: 'pickup' }, d], route)).toBe(false);
  });
  it('keeps a delivery whose collection is scheduled for the route date', () => {
    expect(isRemovableUncollectedDelivery(delivery({ scheduled_pickup_date: '2026-11-09' }), [], route)).toBe(false);
  });
  it('keeps a delivery whose driver is already on the way to collect', () => {
    expect(isRemovableUncollectedDelivery(delivery({ status: 'driver_to_collection' }), [], route)).toBe(false);
  });
  it('removes a delivery with no collection on the route, by the route date or under way', () => {
    expect(isRemovableUncollectedDelivery(delivery({ scheduled_pickup_date: '2026-11-12', status: 'scheduled' }), [], route)).toBe(true);
  });
});

describe('Remove not customer dates', () => {
  it('keeps a stop whose customer dates have all passed (expired)', () => {
    expect(isRemovableNotCustomerDate('delivery', route, null, ['2026-11-02', '2026-11-05'])).toBe(false);
  });
  it('removes a stop whose customer has later dates but not the route date', () => {
    expect(isRemovableNotCustomerDate('delivery', route, null, ['2026-11-05', '2026-11-11'])).toBe(true);
  });
  it('keeps a stop whose customer chose the route date', () => {
    expect(isRemovableNotCustomerDate('pickup', route, ['2026-11-09'], null)).toBe(false);
  });
});
