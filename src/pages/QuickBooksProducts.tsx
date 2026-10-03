import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Pencil, Archive, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Product = {
  id: string; syncToken: string; name: string; type: string; description: string; price: number; active: boolean;
  taxCodeId: string | null; taxCodeName: string | null; incomeAccountId: string | null; incomeAccountName: string | null;
};
type Ref = { id: string; name: string };

// Names the invoice functions look up exactly — renaming/removing breaks invoicing.
const PROTECTED = ["Warehouse Bike Storage", "Bike Inspection & Service", "Box My Bike", "Guaranteed Delivery Date"];
const isProtected = (n: string) =>
  PROTECTED.includes(n) || n.startsWith("Collection and Delivery within England and Wales");

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("quickbooks-products", { body });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as any).context?.json())?.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

const empty = { id: "", syncToken: "", name: "", type: "Service", description: "", price: "", taxCodeId: "", incomeAccountId: "" };

export default function QuickBooksProducts() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"active" | "inactive" | "all">("active");
  const [form, setForm] = useState<typeof empty | null>(null);
  const [originalName, setOriginalName] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<Product | null>(null);

  const products = useQuery({ queryKey: ["qb-products"], queryFn: async () => (await call({ action: "list" })).items as Product[] });
  const refs = useQuery({ queryKey: ["qb-product-refs"], queryFn: () => call({ action: "list_refs" }) as Promise<{ taxCodes: Ref[]; incomeAccounts: Ref[] }>, staleTime: 600000 });

  const list = useMemo(() => {
    const s = search.toLowerCase();
    return (products.data || [])
      .filter((p) => filter === "all" || (filter === "active" ? p.active : !p.active))
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products.data, search, filter]);

  const save = useMutation({
    mutationFn: (f: typeof empty) => call({
      action: f.id ? "update" : "create",
      product: { ...f, price: Number(f.price), taxCodeId: f.taxCodeId || null },
    }),
    onSuccess: () => { toast.success("Saved to QuickBooks"); setForm(null); qc.invalidateQueries({ queryKey: ["qb-products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (p: Product) => call({ action: p.active ? "deactivate" : "reactivate", id: p.id, syncToken: p.syncToken }),
    onSuccess: (_d, p) => { toast.success(p.active ? "Product made inactive" : "Product reactivated"); setConfirmRemove(null); qc.invalidateQueries({ queryKey: ["qb-products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (p?: Product) => {
    setOriginalName(p?.name || "");
    setForm(p ? { id: p.id, syncToken: p.syncToken, name: p.name, type: p.type === "NonInventory" ? "NonInventory" : "Service",
      description: p.description, price: String(p.price), taxCodeId: p.taxCodeId || "", incomeAccountId: p.incomeAccountId || "" } : { ...empty });
  };
  const renaming = form?.id && originalName && form.name.trim() !== originalName && isProtected(originalName);

  return (
    <Layout>
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">QuickBooks Products</h1>
          <Button onClick={() => openEdit()}><Plus className="h-4 w-4 mr-1" />Add product</Button>
        </div>
        <Card>
          <CardHeader className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <CardTitle className="text-base">{list.length} products</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
              <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {products.isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              : products.error ? <p className="text-destructive">{(products.error as Error).message}</p>
              : <div className="divide-y">
                {list.map((p) => (
                  <div key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                    <div className="min-w-0">
                      <div className="font-medium flex flex-wrap items-center gap-2">
                        {p.name}
                        {!p.active && <Badge variant="secondary">Inactive</Badge>}
                        {isProtected(p.name) && <Badge variant="outline">Used by invoices</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {p.type} · £{Number(p.price).toFixed(2)} before VAT{p.taxCodeName ? ` · ${p.taxCodeName}` : ""}{p.incomeAccountName ? ` · ${p.incomeAccountName}` : ""}
                      </div>
                      {p.description && <div className="text-sm text-muted-foreground truncate">{p.description}</div>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
                      {p.active
                        ? <Button size="sm" variant="outline" onClick={() => setConfirmRemove(p)}><Archive className="h-4 w-4 mr-1" />Remove</Button>
                        : <Button size="sm" variant="outline" disabled={toggle.isPending} onClick={() => toggle.mutate(p)}><RotateCcw className="h-4 w-4 mr-1" />Reactivate</Button>}
                    </div>
                  </div>
                ))}
                {!list.length && <p className="text-muted-foreground py-6 text-center">No products found.</p>}
              </div>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              {renaming && <p className="text-sm text-destructive flex gap-1"><AlertTriangle className="h-4 w-4 shrink-0" />Invoices look this product up by its exact name. Renaming it will stop those invoices working.</p>}
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Service">Service</SelectItem><SelectItem value="NonInventory">Non-inventory</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Price before VAT (£)</Label><Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              </div>
              <div><Label>VAT code</Label>
                <Select value={form.taxCodeId || "none"} onValueChange={(v) => setForm({ ...form, taxCodeId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(refs.data?.taxCodes || []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Income account</Label>
                <Select value={form.incomeAccountId} onValueChange={(v) => setForm({ ...form, incomeAccountId: v })}>
                  <SelectTrigger><SelectValue placeholder={refs.isLoading ? "Loading…" : "Choose"} /></SelectTrigger>
                  <SelectContent>{(refs.data?.incomeAccounts || []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button disabled={save.isPending} onClick={() => form && save.mutate(form)}>{save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {confirmRemove?.name}?</DialogTitle>
            <DialogDescription>QuickBooks doesn't allow products to be deleted, so it will be made inactive. You can reactivate it later.</DialogDescription>
          </DialogHeader>
          {confirmRemove && isProtected(confirmRemove.name) && <p className="text-sm text-destructive flex gap-1"><AlertTriangle className="h-4 w-4 shrink-0" />Invoices use this product. Removing it will stop those invoices from being created.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button variant="destructive" disabled={toggle.isPending} onClick={() => confirmRemove && toggle.mutate(confirmRemove)}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
