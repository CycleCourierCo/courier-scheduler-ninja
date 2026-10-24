import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { History, Mail, Plus, RotateCcw, Send } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TEMPLATE_VARIABLES } from "../../supabase/functions/_shared/emailTemplateCore";

const db = supabase as any;

interface Blocks { headline?: string; paragraphs?: string[]; buttonLabel?: string; buttonUrl?: string; closing?: string }
interface Tpl {
  id: string; key: string; name: string; category: string; audience: string; description: string | null;
  trigger_key: string | null; trigger_label: string | null; delay_minutes: number;
  recipients: string[]; cc: string[]; bcc: string[]; enabled: boolean; locked: boolean; is_custom: boolean;
  subject: string | null; preheader: string | null; blocks: Blocks | null; tested_at: string | null; wording_mode?: string;
  sample_subject?: string | null; sample_html?: string | null; sample_at?: string | null;
  updated_at: string; updated_by: string | null;
}

const CATEGORIES: Record<string, string> = {
  order_journey: "Order journey", ni: "Northern Ireland & ferry", box: "Box My Bike", workshop: "Workshop",
  account: "Account", billing: "Billing", partner: "Partner", internal: "Internal", custom: "Custom emails",
};

export const TRIGGERS: { key: string; label: string }[] = [
  { key: "order_created", label: "When an order is created" },
  { key: "status:collection_scheduled", label: "When collection is booked" },
  { key: "status:driver_to_collection", label: "When the driver is on the way to collect" },
  { key: "status:collected", label: "When the bike is collected" },
  { key: "status:delivery_scheduled", label: "When delivery is booked" },
  { key: "status:driver_to_delivery", label: "When the driver is on the way to deliver" },
  { key: "status:delivered", label: "When the bike is delivered" },
  { key: "status:cancelled", label: "When the order is cancelled" },
  { key: "status:in_depot_awaiting_boxing", label: "Box My Bike: arrived at depot" },
  { key: "status:boxed_awaiting_label", label: "Box My Bike: boxed" },
  { key: "status:delivered_to_ferry", label: "Northern Ireland: delivered to ferry" },
];
const DELAYS = [
  { v: 0, l: "Straight away" }, { v: 60, l: "After 1 hour" }, { v: 180, l: "After 3 hours" },
  { v: 1440, l: "After 1 day" }, { v: 2880, l: "After 2 days" }, { v: 10080, l: "After 1 week" },
];

const blank = (): Partial<Tpl> => ({
  name: "", category: "custom", audience: "customer", is_custom: true, enabled: false, locked: false,
  trigger_key: "status:delivered", delay_minutes: 0, recipients: ["sender"], cc: [], bcc: [],
  subject: "", preheader: "", blocks: { headline: "", paragraphs: [""], buttonLabel: "", buttonUrl: "", closing: "" },
});

const splitList = (s: string) => s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);

export default function EmailCentre() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Tpl[]>([]);
  const [search, setSearch] = useState("");
  const [aud, setAud] = useState("all");
  const [edit, setEdit] = useState<Partial<Tpl> | null>(null);

  const load = async () => {
    const { data, error } = await db.from("email_templates").select("id, key, name, category, audience, description, trigger_key, trigger_label, delay_minutes, recipients, cc, bcc, enabled, locked, is_custom, subject, preheader, blocks, tested_at, updated_at, updated_by, wording_mode, sample_subject, sample_at").order("category").order("name");
    if (error) toast.error("Couldn't load emails");
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => rows.filter((r) =>
    (aud === "all" || r.audience === aud) &&
    (!search || `${r.name} ${r.trigger_label ?? ""} ${r.subject ?? ""}`.toLowerCase().includes(search.toLowerCase()))), [rows, search, aud]);

  const groups = useMemo(() => {
    const g: Record<string, Tpl[]> = {};
    for (const r of shown) (g[r.category] ||= []).push(r);
    return g;
  }, [shown]);

  const toggle = async (r: Tpl, on: boolean) => {
    if (r.locked) return toast.error("This email can't be switched off.");
    if (on && r.is_custom && !r.tested_at) return toast.error("Send yourself a test first.");
    const { error } = await db.from("email_templates").update({ enabled: on, updated_by: user?.id, updated_at: new Date().toISOString() }).eq("id", r.id);
    if (error) return toast.error("Couldn't save");
    load();
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Email Centre</h1>
            <p className="text-sm text-muted-foreground">Every email the system sends: when, to whom and what it says.</p>
          </div>
          <Button onClick={() => setEdit(blank())}><Plus className="mr-2 h-4 w-4" />New email</Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search emails" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={aud} onValueChange={setAud}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {Object.entries(groups).map(([cat, list]) => (
          <section key={cat} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{CATEGORIES[cat] || cat}</h2>
            <div className="divide-y rounded-md border bg-card">
              {list.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(r)}>
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      <Mail className="h-4 w-4 text-muted-foreground" />{r.name}
                      {r.locked && <Badge variant="secondary">Always sent</Badge>}
                      {(r.subject || r.blocks) && !r.is_custom && <Badge variant="outline">Edited</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {r.trigger_label || TRIGGERS.find((t) => t.key === r.trigger_key)?.label || "—"} · To {(r.recipients || []).join(", ") || "—"}
                      {r.cc?.length ? ` + ${r.cc.length} copy` : ""}
                    </div>
                  </button>
                  <span className="text-xs text-muted-foreground">Edited {new Date(r.updated_at).toLocaleDateString("en-GB")}</span>
                  <Switch checked={r.locked || r.enabled} disabled={r.locked} onCheckedChange={(v) => toggle(r, v)} aria-label={`Turn ${r.name} on or off`} />
                </div>
              ))}
            </div>
          </section>
        ))}
        {!shown.length && <p className="text-sm text-muted-foreground">No emails match.</p>}
      </div>
      {edit && <Editor tpl={edit} userId={user?.id} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </Layout>
  );
}

function Editor({ tpl, userId, onClose, onSaved }: { tpl: Partial<Tpl>; userId?: string; onClose: () => void; onSaved: () => void }) {
  const [t, setT] = useState<Partial<Tpl>>(() => ({ ...tpl, blocks: tpl.blocks || { headline: "", paragraphs: [""], buttonLabel: "", buttonUrl: "", closing: "" } }));
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [phone, setPhone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<any[] | null>(null);
  const [focus, setFocus] = useState<string>("p0");
  const [sample, setSample] = useState<{ html: string | null; subject: string | null; at: string | null } | null>(null);
  const timer = useRef<number | null>(null);

  // Load the latest real copy of this email.
  useEffect(() => {
    if (!tpl.id) { setSample({ html: null, subject: null, at: null }); return; }
    db.from("email_templates").select("sample_html, sample_subject, sample_at").eq("id", tpl.id).maybeSingle()
      .then(({ data }: any) => setSample({ html: data?.sample_html ?? null, subject: data?.sample_subject ?? null, at: data?.sample_at ?? null }));
  }, [tpl.id]);
  const b = t.blocks as Blocks;
  const setB = (patch: Partial<Blocks>) => setT({ ...t, blocks: { ...b, ...patch } });
  const builtIn = !t.is_custom;

  // Live preview: re-render shortly after typing stops.
  useEffect(() => {
    if (!hasWording(b)) { setPreviewHtml(null); return; }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const { data } = await supabase.functions.invoke("email-template-preview", { body: { mode: "preview", template: { id: t.id, subject: t.subject || sample?.subject, preheader: t.preheader, blocks: t.blocks } } });
      if (data?.html) setPreviewHtml(data.html);
    }, 500);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [t.subject, t.preheader, JSON.stringify(t.blocks), sample?.subject]);

  const copyCurrentWording = () => {
    if (!sample?.html) return;
    const doc = new DOMParser().parseFromString(sample.html, "text/html");
    const card = doc.querySelector("h1")?.closest("td") || doc.body;
    const headline = card.querySelector("h1")?.textContent?.trim() || "";
    const paragraphs = Array.from(card.querySelectorAll("p")).map((p) => p.textContent?.trim() || "")
      .filter((x) => x && !/Cycorco|Company no|VAT|Wake Green|^Info@/i.test(x)).slice(0, 8);
    setB({ headline, paragraphs: paragraphs.length ? paragraphs : [""] });
    toast.message("Current wording copied in", { description: "Swap any customer names, dates or tracking numbers for the detail buttons before saving." });
  };

  const insertVar = (v: string) => {
    const tag = `{{${v}}}`;
    if (focus === "subject") return setT({ ...t, subject: `${t.subject || ""}${tag}` });
    if (focus === "headline") return setB({ headline: `${b.headline || ""}${tag}` });
    const i = Number(focus.slice(1)) || 0;
    const ps = [...(b.paragraphs || [""])];
    ps[i] = `${ps[i] || ""}${tag}`;
    setB({ paragraphs: ps });
  };

  const call = async (mode: "preview" | "test") => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("email-template-preview", { body: { mode, template: { id: t.id, subject: t.subject, preheader: t.preheader, blocks: t.blocks } } });
    setBusy(false);
    if (error || data?.error) return toast.error(data?.error || "Preview failed");
    if (mode === "preview") setPreviewHtml(data.html);
    else { toast.success(`Test sent to ${data.sentTo}`); setT({ ...t, tested_at: new Date().toISOString() }); }
  };

  const save = async () => {
    if (!t.name?.trim()) return toast.error("Give the email a name.");
    if (t.is_custom && !t.subject?.trim()) return toast.error("Add a subject.");
    if (t.is_custom && t.enabled && !t.tested_at) return toast.error("Send yourself a test before switching it on.");
    setBusy(true);
    const payload: any = {
      name: t.name, subject: t.subject?.trim() || null, preheader: t.preheader?.trim() || null,
      blocks: hasWording(b) ? b : null, cc: t.cc || [], bcc: t.bcc || [],
      enabled: t.locked ? true : !!t.enabled, updated_by: userId, updated_at: new Date().toISOString(),
    };
    if (t.is_custom) Object.assign(payload, {
      recipients: t.recipients, trigger_key: t.trigger_key, delay_minutes: t.delay_minutes ?? 0,
      trigger_label: TRIGGERS.find((x) => x.key === t.trigger_key)?.label, category: "custom",
      audience: "customer", is_custom: true, tested_at: t.tested_at ?? null,
    });
    let id = t.id;
    if (id) {
      const { error } = await db.from("email_templates").update(payload).eq("id", id);
      if (error) { setBusy(false); return toast.error("Couldn't save"); }
    } else {
      const key = `custom.${Date.now().toString(36)}`;
      const { data, error } = await db.from("email_templates").insert({ ...payload, key }).select("id").single();
      if (error) { setBusy(false); return toast.error("Couldn't save"); }
      id = data.id;
    }
    await db.from("email_template_versions").insert({ template_id: id, snapshot: payload, edited_by: userId });
    setBusy(false);
    toast.success("Saved");
    onSaved();
  };

  const reset = async () => {
    if (!t.id || !confirm("Go back to the original wording? Copies and on/off stay as they are.")) return;
    await db.from("email_templates").update({ subject: null, preheader: null, blocks: null, updated_by: userId, updated_at: new Date().toISOString() }).eq("id", t.id);
    toast.success("Back to the original wording");
    onSaved();
  };

  const loadVersions = async () => {
    const { data } = await db.from("email_template_versions").select("id, snapshot, created_at").eq("template_id", t.id).order("created_at", { ascending: false }).limit(20);
    setVersions(data || []);
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-6xl">
        <SheetHeader><SheetTitle>{t.id ? t.name : "New email"}</SheetTitle></SheetHeader>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          {builtIn && (
            <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
              {t.wording_mode === "intro"
                ? "Anything you write here is added above the original email, which keeps its own details (amounts, links, report tables). Leave it empty to send the original unchanged."
                : "Leave the wording empty to keep the original email. Anything you write here replaces it."}
              {t.locked && " This email is always sent; you can change its wording but not switch it off."}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Name</Label><Input value={t.name || ""} onChange={(e) => setT({ ...t, name: e.target.value })} disabled={builtIn} /></div>
            <div className="flex items-end gap-2"><Switch checked={t.locked || !!t.enabled} disabled={t.locked} onCheckedChange={(v) => setT({ ...t, enabled: v })} /><span className="text-sm">{t.locked || t.enabled ? "On" : "Off"}</span></div>
          </div>

          {t.is_custom ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>When it's sent</Label>
                <Select value={t.trigger_key || ""} onValueChange={(v) => setT({ ...t, trigger_key: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TRIGGERS.map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Delay</Label>
                <Select value={String(t.delay_minutes ?? 0)} onValueChange={(v) => setT({ ...t, delay_minutes: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DELAYS.map((d) => <SelectItem key={d.v} value={String(d.v)}>{d.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 flex gap-4">
                {(["sender", "receiver"] as const).map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={(t.recipients || []).includes(r)} onCheckedChange={(v) => setT({ ...t, recipients: v ? [...(t.recipients || []), r] : (t.recipients || []).filter((x) => x !== r) })} />
                    {r === "sender" ? "Sender" : "Buyer"}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm"><span className="text-muted-foreground">Sent:</span> {t.trigger_label} · <span className="text-muted-foreground">To:</span> {(t.recipients || []).join(", ")}</div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Extra copies (CC)</Label><Input placeholder="ops@cyclecourierco.com" value={(t.cc || []).join(", ")} onChange={(e) => setT({ ...t, cc: splitList(e.target.value) })} /></div>
            <div><Label>Hidden copies (BCC)</Label><Input value={(t.bcc || []).join(", ")} onChange={(e) => setT({ ...t, bcc: splitList(e.target.value) })} /></div>
          </div>

          {!(t.key?.startsWith("op.") || t.key?.startsWith("internal.")) && <div className="space-y-1">
            <Label>Insert a detail</Label>
            <div className="flex flex-wrap gap-1">{TEMPLATE_VARIABLES.map((v) => <Button key={v} type="button" size="sm" variant="outline" onClick={() => insertVar(v)}>{v.replace(/_/g, " ")}</Button>)}</div>
          </div>}
          <div><Label>Subject</Label><Input value={t.subject || ""} onFocus={() => setFocus("subject")} onChange={(e) => setT({ ...t, subject: e.target.value })} placeholder={sample?.subject ? `Current: ${sample.subject}` : builtIn ? "Leave empty to keep the original" : ""} /></div>
          <div><Label>Inbox preview line</Label><Input value={t.preheader || ""} onChange={(e) => setT({ ...t, preheader: e.target.value })} /></div>
          <div><Label>Headline</Label><Input value={b.headline || ""} onFocus={() => setFocus("headline")} onChange={(e) => setB({ headline: e.target.value })} /></div>
          {(b.paragraphs || [""]).map((p, i) => (
            <div key={i}><Label>Paragraph {i + 1}</Label>
              <Textarea rows={3} value={p} onFocus={() => setFocus(`p${i}`)} onChange={(e) => { const ps = [...(b.paragraphs || [])]; ps[i] = e.target.value; setB({ paragraphs: ps }); }} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setB({ paragraphs: [...(b.paragraphs || []), ""] })}><Plus className="mr-1 h-4 w-4" />Add paragraph</Button>
          {t.wording_mode !== "intro" && <><div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Button label</Label><Input value={b.buttonLabel || ""} onChange={(e) => setB({ buttonLabel: e.target.value })} /></div>
            <div><Label>Button link</Label><Input placeholder="{{tracking_link}}" value={b.buttonUrl || ""} onChange={(e) => setB({ buttonUrl: e.target.value })} /></div>
          </div>
          <div><Label>Closing note</Label><Textarea rows={2} value={b.closing || ""} onChange={(e) => setB({ closing: e.target.value })} /></div></>}

          <div className="flex flex-wrap gap-2">
            {builtIn && sample?.html && t.wording_mode !== "intro" && <Button variant="outline" onClick={copyCurrentWording}>Start from current wording</Button>}
            <Button variant="outline" disabled={busy || !hasWording(b)} onClick={() => call("test")}><Send className="mr-2 h-4 w-4" />Send test to me</Button>
            {t.id && builtIn && <Button variant="outline" onClick={reset}><RotateCcw className="mr-2 h-4 w-4" />Reset to original</Button>}
            {t.id && <Button variant="ghost" onClick={loadVersions}><History className="mr-2 h-4 w-4" />History</Button>}
            <Button className="ml-auto" disabled={busy} onClick={save}>Save</Button>
          </div>

          {versions && (
            <div className="space-y-1 rounded-md border p-3 text-sm">
              {!versions.length && <p className="text-muted-foreground">No saved versions yet.</p>}
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-2">
                  <span>{new Date(v.created_at).toLocaleString("en-GB")} — {v.snapshot.subject || "(original subject)"}</span>
                  <Button size="sm" variant="ghost" onClick={() => setT({ ...t, ...v.snapshot, blocks: v.snapshot.blocks || { paragraphs: [""] } })}>Restore</Button>
                </div>
              ))}
            </div>
          )}

        </div>
        <div className="space-y-2 lg:sticky lg:top-0 lg:self-start">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{previewHtml ? "Preview with your changes" : "Current email"}</span>
            {!previewHtml && sample?.at && <span className="text-xs text-muted-foreground">last sent {new Date(sample.at).toLocaleString("en-GB")}</span>}
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant={phone ? "outline" : "default"} onClick={() => setPhone(false)}>Desktop</Button>
              <Button size="sm" variant={phone ? "default" : "outline"} onClick={() => setPhone(true)}>Phone</Button>
            </div>
          </div>
          {previewHtml || sample?.html ? (
            <iframe title="Email preview" sandbox="" srcDoc={previewHtml || sample?.html || ""} className="mx-auto block h-[720px] rounded-md border bg-background" style={{ width: phone ? 360 : "100%" }} />
          ) : (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              {sample === null ? "Loading…" : t.is_custom ? "Write a headline or paragraph to see the preview." : "Not sent yet since previews were switched on. The preview will appear here after the next one goes out. You can still write new wording and preview it."}
            </div>
          )}
        </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const hasWording = (b?: Blocks | null) => !!b && (!!b.headline?.trim() || (b.paragraphs || []).some((p) => p.trim()));
