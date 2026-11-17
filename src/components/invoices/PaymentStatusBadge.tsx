import { cn } from "@/lib/utils";
import { paymentStatusText, type InvoicePaymentStatus } from "../../../supabase/functions/_shared/invoicePaymentStatus";
import type { InvoicePayment } from "@/hooks/useInvoicePaymentStatuses";

const TONE: Record<InvoicePaymentStatus, string> = {
  paid: "bg-status-done/15 text-status-done border-status-done/30",
  part_paid: "bg-status-waiting/15 text-status-waiting border-status-waiting/30",
  unpaid: "bg-status-booked/15 text-status-booked border-status-booked/30",
  overdue: "bg-status-failed/15 text-status-failed border-status-failed/30",
  voided: "bg-muted text-muted-foreground border-border",
  deleted: "bg-muted text-muted-foreground border-border",
};

const money = (n: number) => `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PaymentStatusBadge({ payment, showBalance = false, className }: { payment: InvoicePayment; showBalance?: boolean; className?: string }) {
  const owing = payment.balance > 0 && !payment.deleted;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", TONE[payment.status], className)}>
      {paymentStatusText(payment)}
      {payment.partPaid && payment.status !== "overdue" && payment.status !== "part_paid" ? <span className="font-normal">· part paid</span> : null}
      {showBalance && owing && (
        <span className="font-normal">
          · {money(payment.balance)} owed{payment.partPaid ? ` of ${money(payment.total_amount)}` : ""}
        </span>
      )}
    </span>
  );
}
