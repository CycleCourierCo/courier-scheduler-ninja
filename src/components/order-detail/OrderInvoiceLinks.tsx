import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { notify } from "@/lib/notify";

type InvoiceLink = {
  id: string;
  quickbooks_invoice_number: string | null;
  quickbooks_invoice_url: string;
  invoice_date: string | null;
};

const ORDER_FIELDS = `id, user_id, status, created_at, tracking_number, bike_brand, bike_model, bike_type, bike_quantity, bikes,
  customer_order_number, sender, receiver, needs_inspection, is_box_my_bike, is_northern_ireland,
  guaranteed_delivery, guaranteed_delivery_payer, guaranteed_delivery_amount, guaranteed_delivery_note,
  scheduled_delivery_date, order_delivered`;

export default function OrderInvoiceLinks({ orderId, canInvoice = false }: { orderId: string; canInvoice?: boolean }) {
  const [links, setLinks] = useState<InvoiceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [customer, setCustomer] = useState<{ name: string | null; email: string | null; accounts_email: string | null } | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadLinks = useCallback(async () => {
    const { data, error } = await supabase.from("order_invoice_links")
      .select("id, quickbooks_invoice_number, quickbooks_invoice_url, invoice_date")
      .eq("order_id", orderId)
      .order("invoice_date", { ascending: false });
    if (error) console.error("Failed to load order invoice links:", error);
    setLinks((data || []) as InvoiceLink[]);
    setLoading(false);
  }, [orderId]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  useEffect(() => {
    if (!canInvoice) return;
    let cancelled = false;
    (async () => {
      const { data: o } = await (supabase.from("orders") as any).select(ORDER_FIELDS).eq("id", orderId).maybeSingle();
      if (cancelled || !o) return;
      setOrder(o);
      const [{ data: prof }, { data: excl }] = await Promise.all([
        supabase.from("profiles").select("name, email, accounts_email").eq("id", o.user_id).maybeSingle(),
        (supabase.from("order_invoice_exclusions") as any).select("reason").eq("order_id", orderId).maybeSingle(),
      ]);
      if (cancelled) return;
      setCustomer(prof as any);
      if ((prof as any)?.email?.toLowerCase() === "shopify@cyclecourierco.com") setBlocked("Website order — paid online at checkout, no invoice needed.");
      else if (excl) setBlocked(`Marked not to be invoiced${excl.reason ? `: ${excl.reason}` : ""}.`);
    })();
    return () => { cancelled = true; };
  }, [orderId, canInvoice]);

  const today = new Date().toISOString().slice(0, 10);
  const isPast = !!order && order.status !== "cancelled" && (
    order.status === "delivered" || order.order_delivered === true ||
    (order.scheduled_delivery_date && String(order.scheduled_delivery_date).slice(0, 10) < today)
  );
  const showCreate = canInvoice && !loading && links.length === 0 && isPast && !blocked;
  const billEmail = customer?.accounts_email || customer?.email || "";

  const createInvoice = async () => {
    if (!order) return;
    setCreating(true);
    try {
      const { user_id, status, scheduled_delivery_date, order_delivered, ...payload } = order;
      const { data, error } = await supabase.functions.invoke("create-quickbooks-invoice", {
        body: {
          customerId: user_id,
          customerEmail: billEmail,
          customerName: customer?.name || "",
          startDate: order.created_at,
          endDate: order.created_at,
          orders: [payload],
          singleOrder: true,
        },
      });
      if (error) {
        let msg = error.message;
        try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      notify.success("Invoice created", { description: "The QuickBooks invoice is now linked to this job." });
      setConfirmOpen(false);
      await loadLinks();
    } catch (e: any) {
      notify.error("Couldn't create invoice", { description: e?.message || "QuickBooks invoice failed" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" /> Invoices
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading invoices…</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">No linked invoice</p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium">Invoice {link.quickbooks_invoice_number ? `#${link.quickbooks_invoice_number}` : "in QuickBooks"}</p>
                  {link.invoice_date && <p className="text-sm text-muted-foreground">{new Date(`${link.invoice_date}T12:00:00`).toLocaleDateString("en-GB")}</p>}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={link.quickbooks_invoice_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> View in QuickBooks
                  </a>
                </Button>
              </div>
            ))}
          </div>
        )}
        {canInvoice && !loading && links.length === 0 && blocked && (
          <p className="text-sm text-muted-foreground">{blocked}</p>
        )}
        {showCreate && (
          <Button size="sm" onClick={() => setConfirmOpen(true)}>
            <Receipt className="mr-2 h-4 w-4" /> Create invoice now
          </Button>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !creating && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create QuickBooks invoice for this job?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Bill to:</span> {customer?.name || "Unknown account"}{billEmail ? ` (${billEmail})` : ""}</p>
                <p><span className="font-medium">Job:</span> {order?.tracking_number}</p>
                <p><span className="font-medium">Bikes:</span> {Array.isArray(order?.bikes) && order.bikes.length
                  ? order.bikes.map((b: any) => [b.brand, b.model].filter(Boolean).join(" ") || "Bike").join(", ")
                  : [order?.bike_brand, order?.bike_model].filter(Boolean).join(" ") || "Bike"}</p>
                <p>Prices, special rates and extras are worked out the same way as normal invoicing, and the invoice is emailed to the account.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creating}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={creating || !billEmail} onClick={(e) => { e.preventDefault(); createInvoice(); }}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
