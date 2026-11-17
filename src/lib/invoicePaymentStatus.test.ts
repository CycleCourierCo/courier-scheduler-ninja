import { describe, expect, it } from "vitest";
import { classifyInvoice, londonToday, paidSoFar, paymentStatusText, summariseInvoices } from "../../supabase/functions/_shared/invoicePaymentStatus";

const TODAY = "2026-11-17";

describe("QuickBooks invoice payment status", () => {
  it("is paid when nothing is left to pay", () => {
    expect(classifyInvoice({ total: 120, balance: 0, dueDate: "2026-10-01" }, TODAY).status).toBe("paid");
  });

  it("is overdue once the due date has passed with money still owed", () => {
    const c = classifyInvoice({ total: 120, balance: 120, dueDate: "2026-11-05" }, TODAY);
    expect(c.status).toBe("overdue");
    expect(c.daysOverdue).toBe(12);
    expect(paymentStatusText(c)).toBe("Overdue 12 days");
  });

  it("is not overdue on the due date itself", () => {
    expect(classifyInvoice({ total: 120, balance: 120, dueDate: TODAY }, TODAY).status).toBe("unpaid");
  });

  it("is part paid when some but not all has been paid and it isn't late", () => {
    expect(classifyInvoice({ total: 120, balance: 40, dueDate: "2026-12-01" }, TODAY).status).toBe("part_paid");
  });

  it("flags a late part payment as overdue and still part paid", () => {
    const c = classifyInvoice({ total: 120, balance: 40, dueDate: "2026-11-16" }, TODAY);
    expect(paymentStatusText(c)).toBe("Overdue 1 day · part paid");
  });

  it("treats a zero-value invoice as voided and a missing one as not in QuickBooks", () => {
    expect(classifyInvoice({ total: 0, balance: 0 }, TODAY).status).toBe("voided");
    expect(classifyInvoice({ total: 120, balance: 120, deleted: true }, TODAY).status).toBe("deleted");
  });

  it("uses the London date, so 00:30 BST on 1 June is already 1 June", () => {
    expect(londonToday(new Date("2026-05-31T23:30:00Z"))).toBe("2026-06-01");
  });

  it("works out what has been paid so far as total minus what is still owed", () => {
    expect(paidSoFar({ total: 5880, balance: 3653 })).toBe(2227);
    expect(paidSoFar({ total: 120, balance: 120 })).toBe(0);
  });

  it("adds up invoiced, paid and owed so the page matches QuickBooks' face value", () => {
    const s = summariseInvoices([{ total: 5880, balance: 3653 }, { total: 120, balance: 120 }]);
    expect(s).toEqual({ invoiced: 6000, paid: 2227, owed: 3773, partPaidCount: 1 });
  });
});
