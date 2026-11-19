/** Amber up to 13 days overdue, red from 14 days. */
export const overdueTier = (maxDaysOverdue: number): "amber" | "red" =>
  maxDaysOverdue >= 14 ? "red" : "amber";
