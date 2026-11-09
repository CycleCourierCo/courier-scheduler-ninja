import { describe, expect, it } from 'vitest';
import { pickTimeslipVehicle } from '../../supabase/functions/_shared/timeslipVehicle';

describe('pickTimeslipVehicle', () => {
  it("uses the driver's assigned van for the day over their default van", () => {
    expect(pickTimeslipVehicle({ assignedVehicleId: 'DF66UZB', existingVehicleId: null, defaultVehicleId: 'AV66UTH' })).toBe('DF66UZB');
  });

  it('keeps the van on an existing draft when there is no assignment', () => {
    expect(pickTimeslipVehicle({ assignedVehicleId: null, existingVehicleId: 'KV18WHR', defaultVehicleId: 'AV66UTH' })).toBe('KV18WHR');
  });

  it('falls back to the default van, then none', () => {
    expect(pickTimeslipVehicle({ defaultVehicleId: 'AV66UTH' })).toBe('AV66UTH');
    expect(pickTimeslipVehicle({})).toBeNull();
  });
});
