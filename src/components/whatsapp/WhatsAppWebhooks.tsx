import { useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

const EVENTS = ["Incoming message", "Delivery status", "Account status", "Template status"];

interface Wh {
  id: string; project_id?: number; webhook_name: string; url: string; timeout?: number;
  is_active: boolean; subscribed_events?: string[] | null; has_secret?: boolean;
}

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("whatsapp-templates", { body });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try { const j = await error.context.json(); msg = [j.error, j.details].filter(Boolean).join(": "); } catch { /* keep */ }
    }
    throw new Error(msg);
  }
  return data;
}

const blank = { id: "", project_id: "", webhook_name: "", url: "", timeout: "10", secret: "", is_active: true, subscribed_events: [...EVENTS] as string[] };

export default function WhatsAppWebhooks() {
  const [items, setItems] = useState<Wh[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof blank | null>(null);
  const [del, setDel] = useState<Wh | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems((await call({ action: "wh_list" })).webhooks || []); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        webhook_name: form.webhook_name, url: form.url, timeout: Number(form.timeout),
        is_active: form.is_active, subscribed_events: form.subscribed_events,
        ...(form.secret ? { secret: form.secret } : {}),
      };
      if (form.id) await call({ action: "wh_update", id: form.id, ...payload });
      else await call({ action: "wh_create", project_id: Number(form.project_id), ...payload });
      toast.success(form.id ? "Webhook updated" : "Webhook added");
      setForm(null); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const toggle = async (w: Wh, v: boolean) => {
    try { await call({ action: "wh_update", id: w.id, is_active: v }); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const remove = async () => {
    if (!del) return;
    try { await call({ action: "wh_delete", id: del.id }); toast.success("Webhook deleted"); load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setDel(null); }
  };

  const newForm = () => setForm({ ...blank, project_id: items[0]?.project_id ? String(items[0].project_id) : "" });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Where SendZen sends incoming messages and delivery updates.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
          <Button onClick={newForm}><Plus className="h-4 w-4 mr-1" />New webhook</Button>
        </div>
      </div>
      {loading ? <p className="text-muted-foreground">Loading…</p> : items.length === 0 ? <p className="text-muted-foreground">No webhooks set up.</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((w) => (
            <Card key={w.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base break-all">{w.webhook_name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Switch checked={w.is_active} onCheckedChange={(v) => toggle(w, v)} aria-label="Active" />
                    <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setForm({
                      ...blank, id: w.id, webhook_name: w.webhook_name, url: w.url, timeout: String(w.timeout ?? 10),
                      is_active: w.is_active, subscribed_events: w.subscribed_events ?? [],
                    })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setDel(w)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs break-all text-muted-foreground">{w.url}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? "Active" : "Paused"}</Badge>
                  {w.has_secret && <Badge variant="outline">Signed</Badge>}
                  {(w.subscribed_events ?? []).map((e) => <Badge key={e} variant="outline">{e}</Badge>)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form?.id ? "Edit webhook" : "New webhook"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.webhook_name} onChange={(e) => setForm({ ...form, webhook_name: e.target.value })} /></div>
              <div><Label>URL</Label><Input value={form.url} placeholder="https://…" onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
              {!form.id && (
                <div><Label>SendZen project ID</Label><Input inputMode="numeric" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value.replace(/\D/g, "") })} /></div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Timeout (seconds)</Label><Input inputMode="numeric" value={form.timeout} onChange={(e) => setForm({ ...form, timeout: e.target.value.replace(/\D/g, "") })} /></div>
                <div className="flex items-end gap-2 pb-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><span className="text-sm">Active</span></div>
              </div>
              <div><Label>Signing secret {form.id && "(leave blank to keep current)"}</Label>
                <Input type="password" autoComplete="off" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} /></div>
              <div className="space-y-1"><Label>Events</Label>
                {EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.subscribed_events.includes(ev)} onCheckedChange={(c) => setForm({
                      ...form, subscribed_events: c ? [...form.subscribed_events, ev] : form.subscribed_events.filter((x) => x !== ev),
                    })} />{ev}
                  </label>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{del?.webhook_name}”?</AlertDialogTitle>
            <AlertDialogDescription>SendZen will stop sending updates to this address. If it's the customer service inbox, incoming WhatsApp replies will stop appearing.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
