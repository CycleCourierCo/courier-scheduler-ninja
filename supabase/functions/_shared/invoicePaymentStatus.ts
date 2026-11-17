// Payment-state rule for QuickBooks invoices. No imports so Vitest and the
// browser use exactly the same rule as the Edge Function.

export type InvoicePaymentStatus = "paid" | "part_paid" | "unpaid" | "overdue" | "voided" | "deleted";

export interface InvoiceFacts {
  total: number;
  balance: number;
  dueDate?: string | null; // YYYY-MM-DD
  deleted?: boolean;
}

export interface InvoiceClassification {
  status: InvoicePaymentStatus;
  /** Whole days past the due date (0 unless overdue). */
  daysOverdue: number;
  /** Something has been paid but not all of it. */
  partPaid: boolean;
}

/** Today's date in Europe/London as YYYY-MM-DD. */
export function londonToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
};

/**
 * Paid = nothing left to pay. Overdue = money still owed and the due date is
 * before today (London). An invoice due today is not overdue yet.
 */
export function classifyInvoice(facts: InvoiceFacts, today: string = londonToday()): InvoiceClassification {
  const total = Number(facts.total) || 0;
  const balance = Number(facts.balance) || 0;
  if (facts.deleted) return { status: "deleted", daysOverdue: 0, partPaid: false };
  if (total <= 0 && balance <= 0) return { status: "voided", daysOverdue: 0, partPaid: false };
  if (balance <= 0) return { status: "paid", daysOverdue: 0, partPaid: false };
  const partPaid = balance < total;
  const due = facts.dueDate ? String(facts.dueDate).slice(0, 10) : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    const late = dayNumber(today) - dayNumber(due);
    if (late > 0) return { status: "overdue", daysOverdue: late, partPaid };
  }
  return { status: partPaid ? "part_paid" : "unpaid", daysOverdue: 0, partPaid };
}

export const PAYMENT_STATUS_LABEL: Record<InvoicePaymentStatus, string> = {
  paid: "Paid",
  part_paid: "Part paid",
  unpaid: "Unpaid",
  overdue: "Overdue",
  voided: "Voided",
  deleted: "Not in QuickBooks",
};

/** Short label, e.g. "Overdue 12 days" or "Overdue 1 day · part paid". */
export function paymentStatusText(c: InvoiceClassification): string {
  if (c.status !== "overdue") return PAYMENT_STATUS_LABEL[c.status];
  return `Overdue ${c.daysOverdue} day${c.daysOverdue === 1 ? "" : "s"}${c.partPaid ? " · part paid" : ""}`;
}
