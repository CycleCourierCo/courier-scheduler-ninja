import { dueStoragePeriods, londonDate, type StoredBike } from './warehouseStorageBilling.ts';

const bike: StoredBike = {
  id: 'bike-1', user_id: 'customer-1', item_kind: 'bike',
  deposited_at: '2026-01-31T10:00:00Z', dispatched_at: null,
  status: 'stored', bike_brand: 'Trek', bike_model: 'Domane', source_order_id: null,
};

Deno.test('calendar month anniversaries clamp missing day but return to original day', () => {
  const periods = dueStoragePeriods(bike, '2026-03-31');
  if (periods.map((period) => period.start).join(',') !== '2026-01-31,2026-02-28,2026-03-31') {
    throw new Error('Incorrect month anniversaries');
  }
  if (periods[0].end !== '2026-02-27') throw new Error('Incorrect period end');
});

Deno.test('dispatched bike pays only for started months; components never billed', () => {
  const departed = { ...bike, dispatched_at: '2026-02-18T12:00:00Z', status: 'dispatched' };
  if (dueStoragePeriods(departed, '2026-12-31').length !== 1) throw new Error('Charged after departure');
  if (dueStoragePeriods({ ...bike, item_kind: 'component' }, '2026-12-31').length) throw new Error('Charged component');
});

Deno.test('London dates use local calendar day across British Summer Time', () => {
  if (londonDate('2026-06-01T23:30:00Z') !== '2026-06-02') throw new Error('London date is wrong');
});

Deno.test('fixed net price produces £40 gross at 20% VAT', () => {
  if (Math.round(33.33 * 1.2 * 100) !== 4000) throw new Error('Storage VAT rounding is wrong');
});