import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { Download, ExternalLink, RefreshCw } from "lucide-react";

type Row = {
  order_id: string;
  tracking_number: string | null;
  customer_name: string | null;
  order_created_at: string;
  cancelled_at: string | null;
  quickbooks_invoice_id: string;
  quickbooks_invoice_number: string | null;
  quickbooks_invoice_url: string | null;
  invoice_date: string | null;
  transport_net_amount: number | null;
  timing: "after" | "before" | "unknown";
  resolved_at: string | null;
  resolution_note: string | null;
};

type QbStatus = { status: string; balance: number; total: number };

const TIMING_LABEL: Record<Row["timing"], string> = {
  after: "Cancelled after invoice",
  before: "Cancelled before invoice",
  unknown: "Cancel date unknown",
};
const QB_LABEL: Record<string, string> = {
  paid: "Paid", part_paid: "Part paid", unpaid: "Unpaid", voided: "Voided", deleted: "Not in QuickBooks",
};

const fmt = (d: string | null) => (d ? format(new Date(d.length === 10 ? `${d}T12:00:00` : d), "d MMM yyyy") : "—");
const money = (n: number) => `£${n.toFixed(2)}`;

export default function CancelledInvoicedPanel() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [qb, setQb] = useState<Record<string, QbStatus>>({});
  const [checking, setChecking] = useState(false);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["cancelled-invoiced-orders"],
    queryFn: async () => {
      const all: Row[] = [];
      for (let start = 0; ; start += 1000) {
        const { data, error } = await (supabase.rpc as any)("cancelled_invoiced_orders").range(start, start + 999);
        if (error) throw error;
        all.push(...((data || []) as Row[]));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
  });

  const filtered = useMemo(() => rows.filter((r) => {
    if (!showResolved && r.resolved_at) return false;
    const q = search.trim().toLowerCase();
    if (q && !`${r.customer_name || ""} ${r.tracking_number || ""} ${r.quickbooks_invoice_number || ""}`.toLowerCase().includes(q)) return false;
    if (from && (!r.invoice_date || r.invoice_date < from)) return false;
    if (to && (!r.invoice_date || r.invoice_date > to)) return false;
    return true;
  }), [rows, search, from, to, showResolved]);

  const total = filtered.reduce((s, r) => s + Number(r.transport_net_amount || 0), 0);

  const checkQb = async () => {
    setChecking(true);
    try {
      const invoiceIds = [...new Set(filtered.map((r) => r.quickbooks_invoice_id))];
      const { data, error } = await supabase.functions.invoke("check-invoice-payment-status", { body: { invoiceIds } });
      if (error || data?.error) throw new Error(data?.error || "Could not check QuickBooks");
      setQb((prev) => ({ ...prev, ...(data.statuses || {}) }));
    } catch (e: any) {
      notify.error(e.message || "Could not check QuickBooks");
    } finally {
      setChecking(false);
    }
  };

  const resolve = async (r: Row) => {
    const note = window.prompt("How was this dealt with? (e.g. credit note CN-123 issued, or no action needed)");
    if (note === null) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from as any)("cancelled_invoice_reviews").upsert({
      order_id: r.order_id, quickbooks_invoice_id: r.quickbooks_invoice_id,
      note: note.slice(0, 1000), resolved_by: user?.id, resolved_at: new Date().toISOString(),
    }, { onConflict: "order_id,quickbooks_invoice_id" });
    if (error) return notify.error("Could not save");
    notify.success("Marked as resolved");
    refetch();
  };

  const reopen = async (r: Row) => {
    const { error } = await (supabase.from as any)("cancelled_invoice_reviews").delete()
      .eq("order_id", r.order_id).eq("quickbooks_invoice_id", r.quickbooks_invoice_id);
    if (error) return notify.error("Could not reopen");
    refetch();
  };

  const downloadCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Tracking", "Customer", "Invoice", "Invoice date", "Job amount (net)", "Cancelled", "Order date", "Timing", "QuickBooks status", "Resolved", "Note"];
    const lines = filtered.map((r) => [
      r.tracking_number, r.customer_name, r.quickbooks_invoice_number, r.invoice_date, r.transport_net_amount,
      r.cancelled_at, r.order_created_at, TIMING_LABEL[r.timing], QB_LABEL[qb[r.quickbooks_invoice_id]?.status] || "",
      r.resolved_at, r.resolution_note,
    ].map(esc).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cancelled-but-invoiced-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cancelled but invoiced</CardTitle>
        <p className="text-sm text-muted-foreground">
          Cancelled jobs that appear on a QuickBooks invoice. Older jobs may show "Cancel date unknown" because the app didn't record cancellation times before now.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <Input className="w-56" placeholder="Customer, tracking or invoice" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Invoice date from" />
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Invoice date to" />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={showResolved} onCheckedChange={(v) => setShowResolved(!!v)} /> Show resolved
          </label>
          <Button variant="outline" size="sm" onClick={checkQb} disabled={checking || filtered.length === 0}>
            <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} /> Check QuickBooks payment
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </div>

        <p className="text-sm">
          <span className="font-medium">{filtered.length} jobs</span> — {money(total)} billed for collection and delivery (net of VAT)
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to review.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-2">Job</th><th className="p-2">Customer</th><th className="p-2">Invoice</th>
                  <th className="p-2">Amount</th><th className="p-2">Cancelled</th><th className="p-2">Timing</th>
                  <th className="p-2">QuickBooks</th><th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const s = qb[r.quickbooks_invoice_id];
                  return (
                    <tr key={`${r.order_id}:${r.quickbooks_invoice_id}`} className="border-t align-top">
                      <td className="p-2">
                        <a className="underline" href={`/orders/${r.order_id}`}>{r.tracking_number}</a>
                        <div className="text-xs text-muted-foreground">Ordered {fmt(r.order_created_at)}</div>
                      </td>
                      <td className="p-2">{r.customer_name || "—"}</td>
                      <td className="p-2">
                        {r.quickbooks_invoice_url ? (
                          <a className="inline-flex items-center gap-1 underline" href={r.quickbooks_invoice_url} target="_blank" rel="noreferrer">
                            #{r.quickbooks_invoice_number || r.quickbooks_invoice_id} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : `#${r.quickbooks_invoice_number || r.quickbooks_invoice_id}`}
                        <div className="text-xs text-muted-foreground">{fmt(r.invoice_date)}</div>
                      </td>
                      <td className="p-2">{money(Number(r.transport_net_amount || 0))}</td>
                      <td className="p-2">{fmt(r.cancelled_at)}</td>
                      <td className="p-2">
                        <Badge variant={r.timing === "unknown" ? "secondary" : "destructive"}>{TIMING_LABEL[r.timing]}</Badge>
                      </td>
                      <td className="p-2">{s ? QB_LABEL[s.status] || s.status : "—"}</td>
                      <td className="p-2">
                        {r.resolved_at ? (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">Resolved: {r.resolution_note || "—"}</div>
                            <Button size="sm" variant="ghost" onClick={() => reopen(r)}>Reopen</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => resolve(r)}>Mark resolved</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
