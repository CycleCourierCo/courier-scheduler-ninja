import { useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type InvoiceLink = {
  id: string;
  quickbooks_invoice_number: string | null;
  quickbooks_invoice_url: string;
  invoice_date: string | null;
};

export default function OrderInvoiceLinks({ orderId }: { orderId: string }) {
  const [links, setLinks] = useState<InvoiceLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.from("order_invoice_links")
      .select("id, quickbooks_invoice_number, quickbooks_invoice_url, invoice_date")
      .eq("order_id", orderId)
      .order("invoice_date", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Failed to load order invoice links:", error);
        setLinks((data || []) as InvoiceLink[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [orderId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" /> Invoices
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}