// Which van a generated timeslip uses. No imports so Vitest tests the same rule.
// The van the driver was assigned for that day wins, then a van already set on an
// existing draft, then the driver's default van. Using the default van first could
// pick up another driver's route for that van and block the timeslip.
export function pickTimeslipVehicle(opts: {
  assignedVehicleId?: string | null;
  existingVehicleId?: string | null;
  defaultVehicleId?: string | null;
}): string | null {
  return opts.assignedVehicleId || opts.existingVehicleId || opts.defaultVehicleId || null;
}
