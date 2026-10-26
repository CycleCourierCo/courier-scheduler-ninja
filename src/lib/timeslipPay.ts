export type PayType = "hourly" | "per_mile";

/** Mirrors the timeslips.total_pay database formula. */
export function calculateTimeslipPay(input: {
  pay_type?: PayType | null;
  total_hours: number;
  hourly_rate?: number | null;
  mileage?: number | null;
  per_mile_rate?: number | null;
  van_allowance?: number | null;
}): number {
  const van = Number(input.van_allowance) || 0;
  if (input.pay_type === "per_mile") {
    return (Number(input.mileage) || 0) * (Number(input.per_mile_rate) || 0) + van;
  }
  return (Number(input.total_hours) || 0) * (Number(input.hourly_rate) || 0) + van;
}
