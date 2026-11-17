import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { classifyInvoice, type InvoiceClassification } from "../../supabase/functions/_shared/invoicePaymentStatus";

export type InvoicePaymentRow = {
  quickbooks_invoice_id: string;
  doc_number: string | null;
  customer_name: string | null;
  txn_date: string | null;
  due_date: string | null;
  total_amount: number;
  balance: number;
  deleted: boolean;
  checked_at: string;
};

export type InvoicePayment = InvoicePaymentRow & InvoiceClassification;

export const withClassification = (r: InvoicePaymentRow): InvoicePayment => ({
  ...r,
  ...classifyInvoice({ total: Number(r.total_amount), balance: Number(r.balance), dueDate: r.due_date, deleted: r.deleted }),
});

/** Saved QuickBooks payment status for the given invoice ids (admin/CS only; others get nothing). */
export function useInvoicePaymentStatuses(ids: (string | null | undefined)[]) {
  const clean = [...new Set(ids.filter((v): v is string => !!v))].sort();
  return useQuery({
    queryKey: ["invoice-payment-statuses", clean],
    enabled: clean.length > 0,
    queryFn: async () => {
      const map = new Map<string, InvoicePayment>();
      for (let i = 0; i < clean.length; i += 200) {
        const { data, error } = await (supabase.from as any)("quickbooks_invoice_status")
          .select("quickbooks_invoice_id, doc_number, customer_name, txn_date, due_date, total_amount, balance, deleted, checked_at")
          .in("quickbooks_invoice_id", clean.slice(i, i + 200));
        if (error) throw error;
        for (const r of (data || []) as InvoicePaymentRow[]) map.set(r.quickbooks_invoice_id, withClassification(r));
      }
      return map;
    },
  });
}
