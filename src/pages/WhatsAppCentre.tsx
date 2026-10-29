import { useEffect, useMemo, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WhatsAppWebhooks from "@/components/whatsapp/WhatsAppWebhooks";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

interface Tpl { id: string | null; name: string; language: string; category: string; status: string; components: any[] }

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

const varCount = (t: string) => {
  const m = t.match(/\{\{(\d+)\}\}/g) || [];
  return new Set(m).size;
};

const statusVariant = (s: string) =>
  s === "APPROVED" ? "default" : s === "REJECTED" ? "destructive" : "secondary";

export default function WhatsAppCentre() {
  const [items, setItems] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Tpl | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", language: "en_GB", category: "UTILITY", header: "", body: "", footer: "", examples: "" });

  const load = async () => {
    setLoading(true);
    try { setItems((await call({ action: "list" })).templates || []); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const [seeding, setSeeding] = useState(false);
  const seed = async () => {
    setSeeding(true);
    try {
      const { results = [] } = await call({ action: "seed_cs" });
      const ok = results.filter((r: any) => r.ok).length;
      const failed = results.filter((r: any) => !r.ok);
      if (ok) toast.success(`${ok} template${ok === 1 ? "" : "s"} submitted for approval`);
      failed.forEach((r: any) => toast.error(`${r.name}: ${/exist/i.test(r.error || "") ? "already exists" : (r.error || "rejected")}`));
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSeeding(false); }
  };

  const shown = useMemo(() => items.filter((t) => t.name.toLowerCase().includes(q.toLowerCase())), [items, q]);
  const nVars = varCount(form.body);

  const create = async () => {
    const examples = form.examples.split("|").map((s) => s.trim()).filter(Boolean);
    if (!form.body.trim()) return toast.error("Message text is required");
    if (examples.length !== nVars) return toast.error(`Give ${nVars} example value(s), separated by |`);
    const components: any[] = [];
    if (form.header.trim()) components.push({ type: "HEADER", format: "TEXT", text: form.header.trim() });
    components.push({ type: "BODY", text: form.body.trim(), ...(nVars ? { example: { body_text: [examples] } } : {}) });
    if (form.footer.trim()) components.push({ type: "FOOTER", text: form.footer.trim() });
    setSaving(true);
    try {
      await call({ action: "create", name: form.name.trim(), language: form.language, category: form.category, components });
      toast.success("Template sent to Meta for approval");
      setOpen(false);
      setForm({ ...form, name: "", header: "", body: "", footer: "", examples: "" });
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!del) return;
    try { await call({ action: "delete", name: del.name, hsm_id: del.id ?? undefined }); toast.success("Template deleted"); load(); }
    catch (e: any) { toast.error(e.message); }
    finally { setDel(null); }
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 space-y-4 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">WhatsApp Centre</h1>
        </div>
        <Tabs defaultValue="templates">
          <TabsList><TabsTrigger value="templates">Templates</TabsTrigger><TabsTrigger value="webhooks">Webhooks</TabsTrigger></TabsList>
          <TabsContent value="webhooks"><WhatsAppWebhooks /></TabsContent>
          <TabsContent value="templates" className="space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
            <Button variant="outline" disabled={seeding} onClick={seed}>{seeding ? "Adding…" : "Add standard CS templates"}</Button>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />New template</Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          WhatsApp templates must be approved by Meta before they can be sent (can take up to 48 hours). Templates can't be edited — create a new one instead.
        </p>
        <Input placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} />
        {loading ? <p className="text-muted-foreground">Loading…</p> : shown.length === 0 ? <p className="text-muted-foreground">No templates found.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {shown.map((t) => {
              const body = t.components?.find((c: any) => c.type === "BODY")?.text;
              return (
                <Card key={`${t.name}-${t.language}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base break-all">{t.name}</CardTitle>
                      <Button size="icon" variant="ghost" aria-label={`Delete ${t.name}`} onClick={() => setDel(t)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={statusVariant(t.status) as any}>{t.status}</Badge>
                      <Badge variant="outline">{t.category}</Badge>
                      <Badge variant="outline">{t.language}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground line-clamp-6">{body || "—"}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New WhatsApp template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label>
              <Input value={form.name} placeholder="order_update" onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Language</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-2" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                  <option value="en_GB">English (UK)</option><option value="en_US">English (US)</option><option value="en">English</option>
                </select></div>
              <div><Label>Category</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="UTILITY">Utility (order updates)</option><option value="MARKETING">Marketing (paid)</option>
                </select></div>
            </div>
            <div><Label>Header (optional)</Label><Input value={form.header} maxLength={60} onChange={(e) => setForm({ ...form, header: e.target.value })} /></div>
            <div><Label>Message</Label>
              <Textarea rows={6} value={form.body} maxLength={1024} placeholder="Hi {{1}}, your bike will be collected on {{2}}…" onChange={(e) => setForm({ ...form, body: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">Use {"{{1}}"}, {"{{2}}"}… for details filled in when sending. Write a full sentence around them or Meta rejects it.</p></div>
            {nVars > 0 && (
              <div><Label>Example values ({nVars}, separated by |)</Label>
                <Input value={form.examples} placeholder="John | Friday 5 September" onChange={(e) => setForm({ ...form, examples: e.target.value })} /></div>
            )}
            <div><Label>Footer (optional)</Label><Input value={form.footer} maxLength={60} onChange={(e) => setForm({ ...form, footer: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving || !form.name}>{saving ? "Submitting…" : "Submit for approval"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{del?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from WhatsApp for every language. Any automatic messages using this template will stop sending. The name can't be reused for 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
