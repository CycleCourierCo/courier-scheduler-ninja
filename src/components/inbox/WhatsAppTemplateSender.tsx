import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendMessage } from "@/services/customerServiceInboxService";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Tpl { name: string; language: string; status: string; components: any[] }

const bodyOf = (t: Tpl) => String(t.components?.find((c: any) => String(c.type).toUpperCase() === "BODY")?.text || "");
const paramsOf = (body: string) => [...new Set([...body.matchAll(/{{(\w+)}}/g)].map((m) => m[1]))];
const label = (p: string) => p.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string;
  defaults: Record<string, string | null | undefined>;
  onSent?: () => void;
}

/** Sends an approved WhatsApp template — the only kind Meta delivers after the 24-hour window. */
export default function WhatsAppTemplateSender({ open, onOpenChange, conversationId, defaults, onSent }: Props) {
  const [items, setItems] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Tpl | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase.functions.invoke("whatsapp-templates", { body: { action: "list" } })
      .then(({ data, error }) => {
        if (error) throw error;
        // Only templates with named variables fit the inbox sender.
        setItems((data?.templates || []).filter((t: Tpl) => t.status === "APPROVED" && !/{{\d+}}/.test(bodyOf(t))));
      })
      .catch(() => toast.error("Couldn't load WhatsApp templates"))
      .finally(() => setLoading(false));
  }, [open]);

  const body = picked ? bodyOf(picked) : "";
  const params = useMemo(() => paramsOf(body), [body]);
  const preview = body.replace(/{{(\w+)}}/g, (_, p) => values[p] || `[${label(p)}]`);

  const pick = (t: Tpl) => {
    setPicked(t);
    const v: Record<string, string> = {};
    for (const p of paramsOf(bodyOf(t))) v[p] = String(defaults[p] ?? "");
    setValues(v);
  };

  const send = async () => {
    if (!picked) return;
    const missing = params.filter((p) => !values[p]?.trim());
    if (missing.length) { toast.error(`Fill in: ${missing.map(label).join(", ")}`); return; }
    setSending(true);
    try {
      await sendMessage({ conversationId, bodyText: preview, template: { name: picked.name, params: values } });
      toast.success("WhatsApp template sent");
      onOpenChange(false);
      setPicked(null);
      onSent?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setPicked(null); }}>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Send WhatsApp template</DialogTitle></DialogHeader>
        {!picked ? (
          loading ? <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          : items.length === 0 ? <p className="text-sm text-muted-foreground">No approved templates yet. Templates wait for WhatsApp approval after being added in WhatsApp Centre.</p>
          : (
            <div className="space-y-2">
              {items.map((t) => (
                <button key={t.name} type="button" onClick={() => pick(t)}
                  className="w-full text-left rounded border p-2 hover:bg-muted">
                  <div className="text-sm font-medium">{label(t.name)}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{bodyOf(t)}</div>
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">
            {params.map((p) => (
              <div key={p} className="space-y-1">
                <Label className="text-xs">{label(p)}</Label>
                <Textarea rows={p === "message" ? 4 : 1} maxLength={p === "message" ? 900 : 200}
                  value={values[p] || ""} onChange={(e) => setValues({ ...values, [p]: e.target.value.replace(/\n{3,}/g, "\n\n") })} />
              </div>
            ))}
            <div className="rounded border bg-muted p-2 text-xs whitespace-pre-wrap">{preview}</div>
          </div>
        )}
        <DialogFooter>
          {picked && <Button variant="outline" onClick={() => setPicked(null)} disabled={sending}>Back</Button>}
          {picked && <Button onClick={send} disabled={sending}>{sending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Send</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
