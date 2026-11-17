import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { overdueTier } from "@/lib/overdueTier";

interface Row { doc_number: string | null; due_date: string; balance: number; days_overdue: number }
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

const OverdueInvoiceBanner = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) { setRows([]); return; }
    (supabase.rpc as any)("my_overdue_invoices").then(({ data }: any) => setRows(data || []));
  }, [user]);

  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + Number(r.balance), 0);
  const tier = overdueTier(Math.max(...rows.map(r => r.days_overdue)));
  const red = tier === "red";
  const Icon = red ? AlertCircle : AlertTriangle;
  const count = `${rows.length} overdue invoice${rows.length > 1 ? "s" : ""}`;

  return (
    <div role="alert" className={`w-full border-b border-l-4 px-4 py-2 text-sm ${red ? "border-l-destructive bg-destructive text-destructive-foreground" : "chevron-tape border-l-status-waiting bg-card text-card-foreground"}`}>
      <div className="flex flex-wrap items-center justify-center gap-2 text-center">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="font-semibold">
          {red
            ? `Urgent: ${gbp(total)} across ${count} is significantly overdue. Please pay now to avoid losing access to your account and bookings.`
            : `You have ${count} totalling ${gbp(total)}. Please arrange payment to avoid losing access to your account.`}
        </span>
        <button type="button" onClick={() => setOpen(o => !o)} className="underline font-semibold">
          {open ? "Hide invoices" : "View invoices"}
        </button>
      </div>
      {open && (
        <ul className="mx-auto mt-2 max-w-md space-y-1">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span>Invoice #{r.doc_number ?? "—"} · due {new Date(r.due_date).toLocaleDateString("en-GB")} ({r.days_overdue} days)</span>
              <span className="font-semibold">{gbp(Number(r.balance))}</span>
            </li>
          ))}
          <li className="pt-1 text-center">Questions? Email Info@cyclecourierco.com</li>
        </ul>
      )}
    </div>
  );
};
export default OverdueInvoiceBanner;
