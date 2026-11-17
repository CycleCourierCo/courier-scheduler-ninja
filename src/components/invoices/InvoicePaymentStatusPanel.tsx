import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Download, ExternalLink, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { withClassification, type InvoicePayment, type InvoicePaymentRow } from "@/hooks/useInvoicePaymentStatuses";
import { paymentStatusText } from "../../../supabase/functions/_shared/invoicePaymentStatus";
import PaymentStatusBadge from "./PaymentStatusBadge";

const money = (n: number) => `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: string | null) => (d ? format(new Date(`${d.slice(0, 10)}T12:00:00`), "d MMM yyyy") : "—");
const qbUrl = (id: string) => `https://qbo.intuit.com/app/invoice?txnId=${id}`;
const PAGE_SIZE = 25;

type View = "overdue" | "unpaid" | "customers";

export default function InvoicePaymentStatusPanel() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("overdue");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["quickbooks-open-invoices"],
    queryFn: async () => {
      const rows: InvoicePaymentRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase.from as any)("quickbooks_invoice_status")
          .select("quickbooks_invoice_id, doc_number, customer_name, txn_date, due_date, total_amount, balance, deleted, checked_at")
          .gt("balance", 0).eq("deleted", false)
          .order("due_date", { ascending: true, nullsFirst: false })
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...((data || []) as InvoicePaymentRow[]));
        if (!data || data.length < 1000) break;
      }
      const { data: last } = await (supabase.from as any)("quickbooks_invoice_status")
        .select("checked_at").order("checked_at", { ascending: false }).limit(1).maybeSingle();
      return { rows: rows.map(withClassification), lastChecked: (last?.checked_at as string | undefined) || null };
    },
  });

  const all = data?.rows || [];
  const overdue = all.filter((r) => r.status === "overdue");
  const sum = (list: InvoicePayment[]) => list.reduce((s, r) => s + Number(r.balance || 0), 0);
  const in7 = (() => {
    const limit = new Date(); limit.setDate(limit.getDate() + 7);
    const max = format(limit, "yyyy-MM-dd");
    return all.filter((r) => r.status !== "overdue" && r.due_date && r.due_date <= max);
  })();

  const q = search.trim().toLowerCase();
  const matches = (r: InvoicePayment) => !q || `${r.customer_name || ""} ${r.doc_number || ""}`.toLowerCase().includes(q);

  const list = useMemo(() => {
    const base = (view === "overdue" ? overdue : all).filter(matches);
    return [...base].sort((a, b) => b.daysOverdue - a.daysOverdue || String(a.due_date).localeCompare(String(b.due_date)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, view, q]);

  const customers = useMemo(() => {
    const m = new Map<string, { name: string; count: number; owed: number; overdue: number; overdueCount: number; oldest: number }>();
    for (const r of all.filter(matches)) {
      const name = r.customer_name || "Unknown customer";
      const c = m.get(name) || { name, count: 0, owed: 0, overdue: 0, overdueCount: 0, oldest: 0 };
      c.count += 1; c.owed += Number(r.balance);
      if (r.status === "overdue") { c.overdue += Number(r.balance); c.overdueCount += 1; c.oldest = Math.max(c.oldest, r.daysOverdue); }
      m.set(name, c);
    }
    return [...m.values()].sort((a, b) => b.overdue - a.overdue || b.owed - a.owed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, q]);

  const total = view === "customers" ? customers.length : list.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = <T,>(items: T[]) => items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-invoice-payment-status", { body: {} });
      if (error || data?.error) throw new Error(data?.error || "Could not check QuickBooks");
      notify.success("Payments updated", { description: `${data.openCount} invoices still have money owing.` });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-open-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-payment-statuses"] });
    } catch (e: any) {
      notify.error("Couldn't check QuickBooks", { description: e?.message || "Please try again" });
    } finally {
      setSyncing(false);
    }
  };

  const downloadCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = view === "customers"
      ? [["Customer", "Unpaid invoices", "Owed", "Overdue invoices", "Overdue amount", "Oldest overdue (days)"],
        ...customers.map((c) => [c.name, c.count, c.owed.toFixed(2), c.overdueCount, c.overdue.toFixed(2), c.oldest])]
      : [["Customer", "Invoice", "Invoice date", "Due date", "Total", "Owed", "Status"],
        ...list.map((r) => [r.customer_name, r.doc_number, r.txn_date, r.due_date, Number(r.total_amount).toFixed(2), Number(r.balance).toFixed(2), paymentStatusText(r)])];
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `quickbooks-${view}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Invoice payments</CardTitle>
            <p className="text-sm text-muted-foreground">
              What customers still owe in QuickBooks. Checked automatically each morning and afternoon
              {data?.lastChecked ? ` · last checked ${formatDistanceToNow(new Date(data.lastChecked), { addSuffix: true })}` : ""}.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={syncNow} disabled={syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Checking QuickBooks…" : "Check QuickBooks now"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Owed in total</p>
            <p className="text-xl font-semibold">{money(sum(all))}</p>
            <p className="text-xs text-muted-foreground">{all.length} unpaid invoice{all.length === 1 ? "" : "s"}</p>
          </div>
          <div className="rounded-md border border-status-failed/40 bg-status-failed/5 p-3">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-xl font-semibold text-status-failed">{money(sum(overdue))}</p>
            <p className="text-xs text-muted-foreground">{overdue.length} invoice{overdue.length === 1 ? "" : "s"} past the due date</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Due in the next 7 days</p>
            <p className="text-xl font-semibold">{money(sum(in7))}</p>
            <p className="text-xs text-muted-foreground">{in7.length} invoice{in7.length === 1 ? "" : "s"}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={view} onValueChange={(v) => { setView(v as View); setPage(1); }}>
            <TabsList>
              <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
              <TabsTrigger value="unpaid">All unpaid ({all.length})</TabsTrigger>
              <TabsTrigger value="customers">By customer</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input className="w-56" placeholder="Customer or invoice number" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={total === 0}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">
            {all.length === 0 && !data?.lastChecked ? "No payment information yet. Press Check QuickBooks now." : view === "overdue" ? "Nothing overdue." : "Nothing owed."}
          </p>
        ) : view === "customers" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="p-2">Customer</th><th className="p-2">Unpaid</th><th className="p-2">Owed</th><th className="p-2">Overdue</th><th className="p-2">Oldest overdue</th></tr>
              </thead>
              <tbody>
                {slice(customers).map((c) => (
                  <tr key={c.name} className="border-t">
                    <td className="p-2">
                      <button type="button" className="text-left underline" onClick={() => { setSearch(c.name); setView("unpaid"); setPage(1); }}>{c.name}</button>
                    </td>
                    <td className="p-2">{c.count}</td>
                    <td className="p-2">{money(c.owed)}</td>
                    <td className="p-2">{c.overdueCount ? <span className="font-medium text-status-failed">{money(c.overdue)} ({c.overdueCount})</span> : "—"}</td>
                    <td className="p-2">{c.oldest ? `${c.oldest} day${c.oldest === 1 ? "" : "s"}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="p-2">Customer</th><th className="p-2">Invoice</th><th className="p-2">Due</th><th className="p-2">Total</th><th className="p-2">Owed</th><th className="p-2">Status</th></tr>
              </thead>
              <tbody>
                {slice(list).map((r) => (
                  <tr key={r.quickbooks_invoice_id} className="border-t align-top">
                    <td className="p-2">{r.customer_name || "—"}</td>
                    <td className="p-2">
                      <a className="inline-flex items-center gap-1 underline" href={qbUrl(r.quickbooks_invoice_id)} target="_blank" rel="noreferrer">
                        #{r.doc_number || r.quickbooks_invoice_id} <ExternalLink className="h-3 w-3" />
                      </a>
                      <div className="text-xs text-muted-foreground">{day(r.txn_date)}</div>
                    </td>
                    <td className="p-2">{day(r.due_date)}</td>
                    <td className="p-2">{money(r.total_amount)}</td>
                    <td className="p-2 font-medium">{money(r.balance)}</td>
                    <td className="p-2"><PaymentStatusBadge payment={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Page {safePage} of {pageCount}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
