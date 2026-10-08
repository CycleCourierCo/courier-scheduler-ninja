import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { estimateOrderNet, clearSpecialRatePriceCache } from "@/services/profitabilityService";

type UnlinkedOrder = {
  order_id: string;
  tracking_number: string | null;
  customer_name: string | null;
  customer_id: string | null;
  created_at: string;
  bikes: unknown;
  bike_type: string | null;
  bike_quantity: number | null;
  is_b2b: boolean | null;
  paid_by_card: boolean | null;
  estimate: number;
};

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

const tagFor = (o: UnlinkedOrder) => {
  if (o.paid_by_card) return "Customer paid by card";
  if (o.is_b2b) return "Business – not invoiced";
  return "Not invoiced";
};

const UnlinkedInvoicesPanel = ({ onChanged }: { onChanged: () => void }) => {
  const [open, setOpen] = useState(false);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [customer, setCustomer] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["unlinked-invoice-orders"],
    enabled: open,
    queryFn: async () => {
      const all: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase.rpc as any)("unlinked_invoice_orders").range(from, from + 999);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      clearSpecialRatePriceCache();
      const out: UnlinkedOrder[] = [];
      for (const o of all) {
        const date = String(o.created_at).slice(0, 10);
        const estimate = await estimateOrderNet({ ...o, user_id: o.customer_id }, date).catch(() => 0);
        out.push({ ...o, estimate });
      }
      return out;
    },
  });

  const { data: unmatched = [] } = useQuery({
    queryKey: ["quickbooks-unmatched-invoices"],
    enabled: showUnmatched,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("quickbooks_unmatched_invoices")
        .select("*").order("invoice_date", { ascending: false });
      if (error) throw error;
      return data as Array<{ quickbooks_invoice_id: string; invoice_number: string | null; customer_name: string | null; invoice_date: string | null; total_amount: number | null }>;
    },
  });

  // Website (Shopify) orders are paid at checkout, so they never need an invoice — show how many were excluded
  const { data: shopifyCount = 0 } = useQuery({
    queryKey: ["shopify-excluded-orders-count"],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", "shopify@cyclecourierco.com")
        .maybeSingle();
      if (!profile?.id) return 0;
      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("order_delivered", true);
      if (error) return 0;
      return count ?? 0;
    },
    staleTime: 10 * 60 * 1000,
  });

  const customers = useMemo(
    () => Array.from(new Set(orders.map((o) => o.customer_name || "Unknown"))).sort(),
    [orders]
  );
  const filtered = orders.filter((o) => customer === "all" || (o.customer_name || "Unknown") === customer);
  const months = useMemo(() => {
    const m = new Map<string, UnlinkedOrder[]>();
    for (const o of filtered) {
      const k = o.created_at.slice(0, 7);
      m.set(k, [...(m.get(k) || []), o]);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const done = () => {
    setSelected(new Set());
    refetch();
    onChanged();
  };

  const linkSelected = async () => {
    if (!invoiceNumber.trim() || selected.size === 0) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("link-order-invoice", {
        body: { invoiceNumber: invoiceNumber.trim(), orderIds: Array.from(selected) },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      notify.success(`Linked ${data.linked} job${data.linked === 1 ? "" : "s"} to invoice ${data.invoiceNumber}`, {
        description: data.customer ? `QuickBooks customer: ${data.customer}` : undefined,
      });
      setInvoiceNumber("");
      done();
    } catch (e: any) {
      notify.error("Couldn't link invoice", { description: e?.message || "Try again" });
    } finally {
      setBusy(false);
    }
  };

  const excludeSelected = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const rows = Array.from(selected).map((order_id) => ({ order_id, created_by: user?.id ?? null }));
      const { error } = await (supabase.from as any)("order_invoice_exclusions").upsert(rows);
      if (error) throw error;
      notify.success(`Marked ${rows.length} job${rows.length === 1 ? "" : "s"} as not to be invoiced`);
      done();
    } catch (e: any) {
      notify.error("Couldn't update jobs", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Jobs with no linked invoice</CardTitle>
          <CardDescription>
            Link jobs to a QuickBooks invoice by its number, or mark them as not to be invoiced.
            {shopifyCount > 0 && (
              <span className="block mt-1">
                {shopifyCount.toLocaleString("en-GB")} website orders excluded — paid online at checkout, no invoice needed.
              </span>
            )}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowUnmatched((v) => !v)}>
            {showUnmatched ? "Hide" : "Show"} invoices with no tracking numbers
          </Button>
          <Button size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide unlinked jobs" : "Link invoices"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showUnmatched && (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmatched.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-muted-foreground">None saved yet. Run Sync order invoice links to fill this list.</TableCell></TableRow>
                )}
                {unmatched.map((u) => (
                  <TableRow key={u.quickbooks_invoice_id}>
                    <TableCell>
                      <a className="underline" target="_blank" rel="noreferrer" href={`https://qbo.intuit.com/app/invoice?txnId=${u.quickbooks_invoice_id}`}>
                        {u.invoice_number || u.quickbooks_invoice_id}
                      </a>
                    </TableCell>
                    <TableCell>{u.customer_name || "—"}</TableCell>
                    <TableCell>{u.invoice_date ? format(new Date(`${u.invoice_date}T12:00:00`), "d MMM yyyy") : "—"}</TableCell>
                    <TableCell className="text-right">{u.total_amount != null ? `£${Number(u.total_amount).toFixed(2)}` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {open && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={customer} onValueChange={(v) => { setCustomer(v); setSelected(new Set()); }}>
                <SelectTrigger className="w-64"><SelectValue placeholder="All customers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  {customers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border bg-card p-3 shadow-sm">
              <span className="text-sm font-medium">{selected.size} job{selected.size === 1 ? "" : "s"} ticked</span>
              <Input
                className="w-44"
                placeholder="QuickBooks invoice no."
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") linkSelected(); }}
              />
              <Button size="sm" disabled={busy || !invoiceNumber.trim() || selected.size === 0} onClick={linkSelected}>
                {busy ? "Linking…" : "Link to invoice"}
              </Button>
              <Button size="sm" variant="outline" disabled={busy || selected.size === 0} onClick={excludeSelected}>Mark not to be invoiced</Button>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading jobs…</p>
            ) : months.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unlinked jobs.</p>
            ) : (
              <div className="space-y-2">
                {months.map(([month, rows]) => {
                  const isOpen = openMonths.has(month);
                  const allTicked = rows.every((r) => selected.has(r.order_id));
                  return (
                    <div key={month} className="rounded-md border">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                        onClick={() => {
                          const n = new Set(openMonths);
                          n.has(month) ? n.delete(month) : n.add(month);
                          setOpenMonths(n);
                        }}
                      >
                        <span className="font-medium">{format(new Date(`${month}-15T12:00:00`), "MMMM yyyy")}</span>
                        <span className="text-muted-foreground">{rows.length} jobs · about {gbp(rows.reduce((s, r) => s + r.estimate, 0))} (no VAT)</span>
                      </button>
                      {isOpen && (
                        <div className="overflow-x-auto border-t">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-8">
                                  <Checkbox
                                    checked={allTicked}
                                    onCheckedChange={() => {
                                      const n = new Set(selected);
                                      rows.forEach((r) => (allTicked ? n.delete(r.order_id) : n.add(r.order_id)));
                                      setSelected(n);
                                    }}
                                  />
                                </TableHead>
                                <TableHead>Tracking</TableHead><TableHead>Customer</TableHead><TableHead>Booked</TableHead>
                                <TableHead>Why</TableHead><TableHead className="text-right">Estimate</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {rows.map((o) => (
                                <TableRow key={o.order_id}>
                                  <TableCell><Checkbox checked={selected.has(o.order_id)} onCheckedChange={() => toggle(o.order_id)} /></TableCell>
                                  <TableCell><Link className="underline" to={`/orders/${o.order_id}`}>{o.tracking_number || "—"}</Link></TableCell>
                                  <TableCell>{o.customer_name || "Unknown"}</TableCell>
                                  <TableCell>{format(new Date(o.created_at), "d MMM yyyy")}</TableCell>
                                  <TableCell><Badge variant="secondary">{tagFor(o)}</Badge></TableCell>
                                  <TableCell className="text-right">{gbp(o.estimate)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default UnlinkedInvoicesPanel;
