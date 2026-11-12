import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ChevronLeft, ChevronRight, Edit, PackageSearch, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getOrdersByIds, searchOrdersForClaim, type ClaimOrder } from "@/services/claimsService";
import { itemPhotoUrl, listLostFoundItems, LOCATION_CHECKS, lostFoundQueryKey, setLocationCheck, uploadItemPhoto, validateItemPhoto, type LostFoundItem, type LocationCheck } from "@/services/lostFoundService";

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Could not save. Please try again.";

function ItemPhoto({ path, name }: { path: string | null; name: string }) {
  const { data, isError } = useQuery({ queryKey: ["lost-found-photo", path], queryFn: () => itemPhotoUrl(path ?? ""), enabled: !!path, staleTime: 30 * 60 * 1000 });
  return <div className="aspect-square w-28 shrink-0 rounded-md bg-muted flex items-center justify-center overflow-hidden">
    {data ? <a href={data} target="_blank" rel="noreferrer" aria-label={`View photo of ${name}`}><img src={data} alt={name} className="w-28 h-28 object-cover" /></a> : <span className="text-xs text-muted-foreground text-center p-2">{isError ? "Photo unavailable" : path ? "Loading photo…" : <Camera className="h-6 w-6" />}</span>}
  </div>;
}

function ItemEditor({ item, onClose }: { item: LostFoundItem | null; onClose: () => void }) {
  const cache = useQueryClient();
  const [name, setName] = useState(item?.item_name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [type, setType] = useState(item?.item_type ?? "lost");
  const [orderId, setOrderId] = useState(item?.order_id ?? "");
  const [orderLabel, setOrderLabel] = useState("");
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(item?.id ?? "");
  useEffect(() => { const timer = setTimeout(() => setDebounced(term), 250); return () => clearTimeout(timer); }, [term]);
  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const orders = useQuery({ queryKey: ["lost-found-order-search", debounced], queryFn: () => searchOrdersForClaim(debounced), enabled: !orderId });
  const linked = useQuery({ queryKey: ["lost-found-linked-order", orderId], queryFn: () => getOrdersByIds([orderId]), enabled: !!orderId });
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orderId || !name.trim()) { toast.error("Add an item name and link an order"); return; }
    setSaving(true);
    try {
      const payload = { item_name: name.trim(), description: description.trim(), item_type: type, order_id: orderId };
      const query = savedId ? supabase.from("lost_found_items").update(payload).eq("id", savedId) : supabase.from("lost_found_items").insert(payload);
      const { data, error } = await query.select().single();
      if (error) throw error;
      setSavedId(data.id);
      if (photo) {
        try { await uploadItemPhoto(data.id, photo); }
        catch (error) { toast.error(`Item saved, but photo failed: ${errorMessage(error)}`); await cache.invalidateQueries({ queryKey: lostFoundQueryKey }); return; }
      }
      await cache.invalidateQueries({ queryKey: lostFoundQueryKey });
      toast.success("Item saved"); onClose();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="flex min-w-0 max-w-xl max-h-[calc(100dvh-1rem)] flex-col gap-3 overflow-hidden p-4 sm:max-h-[90dvh]"><DialogHeader className="shrink-0 pr-6 text-left"><DialogTitle>{item ? "Edit item" : "New lost or found item"}</DialogTitle></DialogHeader>
    <form onSubmit={save} className="flex min-h-0 min-w-0 flex-col gap-3">
      <div className="min-h-0 min-w-0 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain [&_input]:min-w-0 [&_input]:max-w-full [&_input]:text-base [&_textarea]:text-base">
      <div className="grid min-w-0 grid-cols-[100px_minmax(0,1fr)] sm:grid-cols-[130px_minmax(0,1fr)] gap-3"><div className="min-w-0 space-y-1"><Label>Item type</Label><Select value={type} onValueChange={setType}><SelectTrigger aria-label="Item type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lost">Lost</SelectItem><SelectItem value="found">Found</SelectItem></SelectContent></Select></div><div className="min-w-0 space-y-1"><Label htmlFor="item-name">Item name</Label><Input id="item-name" value={name} onChange={e => setName(e.target.value)} maxLength={200} required /></div></div>
      <div className="space-y-2"><Label htmlFor="order-search">Linked order</Label>{orderId ? <div className="flex items-center justify-between gap-2 border rounded-md p-3"><span className="font-mono text-sm break-all">{orderLabel || linked.data?.[orderId]?.tracking_number || orderId}</span><Button type="button" size="icon" variant="ghost" aria-label="Change linked order" onClick={() => { setOrderId(""); setOrderLabel(""); }}><X className="h-4 w-4" /></Button></div> : <><Input id="order-search" placeholder="Tracking number or contact name…" value={term} onChange={e => setTerm(e.target.value)} /><div className="border rounded-md max-h-44 overflow-y-auto">{orders.isLoading ? <p className="p-3 text-sm">Searching…</p> : orders.isError ? <p className="p-3 text-sm text-destructive">Order search failed</p> : !orders.data?.length ? <p className="p-3 text-sm text-muted-foreground">No orders found</p> : orders.data.map(order => <Button key={order.id} type="button" variant="ghost" className="w-full h-auto py-3 justify-start flex-col items-start rounded-none" onClick={() => { setOrderId(order.id); setOrderLabel(order.tracking_number ?? order.id); }}><span className="font-mono text-xs">{order.tracking_number}</span><span className="text-xs text-muted-foreground truncate max-w-full">{order.sender?.name ?? "—"} → {order.receiver?.name ?? "—"}</span></Button>)}</div></>}</div>
      <div className="space-y-1"><Label htmlFor="item-description">Description / notes</Label><Textarea id="item-description" value={description} onChange={e => setDescription(e.target.value)} rows={2} className="min-h-16" /></div>
      <div className="space-y-2"><Label htmlFor="item-photo">Item photo</Label><Input id="item-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; if (!file) return; try { validateItemPhoto(file); setPhoto(file); } catch (error) { toast.error(errorMessage(error)); e.target.value = ""; } }} />{preview ? <img src={preview} alt="Selected item" className="h-32 w-32 object-cover rounded-md" /> : item?.photo_path ? <ItemPhoto path={item.photo_path} name={name} /> : null}</div>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t pt-3"><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save item"}</Button></div>
    </form>
  </DialogContent></Dialog>;
}

export default function LostAndFound() {
  const cache = useQueryClient();
  const [search, setSearch] = useState(""); const [debounced, setDebounced] = useState("");
  const [type, setType] = useState("all"); const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<{ item: LostFoundItem | null } | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  useEffect(() => { const timer = setTimeout(() => { setDebounced(search); setPage(0); }, 250); return () => clearTimeout(timer); }, [search]);
  const items = useQuery({ queryKey: [...lostFoundQueryKey, page, debounced, type], queryFn: () => listLostFoundItems(page, debounced, type) });
  const ids = items.data?.items.map(item => item.order_id) ?? [];
  const orders = useQuery({ queryKey: ["lost-found-orders", ids], queryFn: () => getOrdersByIds(ids), enabled: ids.length > 0 });
  const check = async (item: LostFoundItem, key: LocationCheck, checked: boolean) => {
    setPending(prev => [...prev, item.id]);
    try { await setLocationCheck(item.id, key, checked); await cache.invalidateQueries({ queryKey: lostFoundQueryKey }); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setPending(prev => prev.filter(id => id !== item.id)); }
  };
  return <Layout><main className="container max-w-6xl mx-auto px-4 py-6 space-y-5">
    <div className="flex flex-wrap justify-between items-center gap-3"><h1 className="text-2xl font-bold flex items-center gap-2"><PackageSearch className="h-6 w-6 text-primary" />Lost and Found</h1><Button onClick={() => setEditor({ item: null })}><Plus className="h-4 w-4 mr-2" />New item</Button></div>
    <div className="flex flex-wrap gap-3"><div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search items" placeholder="Search item names…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div><Select value={type} onValueChange={value => { setType(value); setPage(0); }}><SelectTrigger className="w-36" aria-label="Filter item type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All items</SelectItem><SelectItem value="lost">Lost</SelectItem><SelectItem value="found">Found</SelectItem></SelectContent></Select></div>
    {items.isLoading ? <p className="py-12 text-center text-muted-foreground">Loading items…</p> : items.isError ? <div className="py-8 text-center space-y-3"><p className="text-destructive">Could not load items</p><Button variant="outline" onClick={() => items.refetch()}>Try again</Button></div> : !items.data?.items.length ? <div className="border-y py-16 text-center text-muted-foreground"><PackageSearch className="h-9 w-9 mx-auto mb-3" /><p>No lost or found items</p></div> : <div className="space-y-3">{items.data.items.map(item => {
      const order: ClaimOrder | undefined = orders.data?.[item.order_id];
      return <article key={item.id} className="border rounded-lg p-4 bg-card flex flex-wrap sm:flex-nowrap gap-4">
        <ItemPhoto path={item.photo_path} name={item.item_name} /><div className="flex-1 min-w-0 space-y-3"><div className="flex justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold break-words">{item.item_name}</h2><Badge variant={item.item_type === "lost" ? "outline" : "secondary"}>{item.item_type === "lost" ? "Lost" : "Found"}</Badge>{item.source === "customer" && <Badge>Customer report</Badge>}</div><Link to={`/orders/${item.order_id}`} className="text-sm font-mono text-primary underline break-all">{order?.tracking_number ?? "View linked order"}</Link><p className="text-xs text-muted-foreground mt-1">{new Date(item.created_at).toLocaleDateString("en-GB", { timeZone: "Europe/London" })}</p></div><Button size="icon" variant="ghost" aria-label={`Edit ${item.item_name}`} onClick={() => setEditor({ item })}><Edit className="h-4 w-4" /></Button></div>{item.description && <p className="text-sm whitespace-pre-wrap break-words">{item.description}</p>}{item.source === "customer" && <p className="text-sm break-words text-muted-foreground">Reported by {item.reporter_name} · <a className="underline" href={`mailto:${item.reporter_email}`}>{item.reporter_email}</a>{item.reporter_phone ? ` · ${item.reporter_phone}` : ""}</p>}<div className="flex flex-wrap gap-x-6 gap-y-3 border-t pt-3">{LOCATION_CHECKS.map(location => <label key={location.key} className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={item[location.key]} disabled={pending.includes(item.id)} onCheckedChange={value => check(item, location.key, value === true)} />{location.label}</label>)}</div></div>
      </article>;
    })}</div>}
    {(items.data?.count ?? 0) > 0 && <div className="flex justify-between items-center text-sm text-muted-foreground"><span>{page * 30 + 1}–{Math.min((page + 1) * 30, items.data?.count ?? 0)} of {items.data?.count} items</span><div className="flex gap-2"><Button size="icon" variant="outline" aria-label="Previous page" disabled={!page} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button size="icon" variant="outline" aria-label="Next page" disabled={(page + 1) * 30 >= (items.data?.count ?? 0)} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>}
    {editor && <ItemEditor item={editor.item} onClose={() => setEditor(null)} />}
  </main></Layout>;
}