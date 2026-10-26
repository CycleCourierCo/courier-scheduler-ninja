import { useEffect, useState } from "react";
import { Copy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface EtaTarget {
  registration: string;
  stop?: { saved_route_id: string; date: string; stop_index: number; label: string; orderId?: string; type?: string };
}

async function invokeEta(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("eta-link", { body });
  if (error) {
    let msg = "Couldn't create the ETA link";
    try { const b = await (error as any).context?.json(); if (b?.error) msg = b.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data;
}

export function SendEtaLinkDialog({ target, onClose }: { target: EtaTarget | null; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const stop = target?.stop;

  // Pre-fill the stop's contact from the order snapshot (collection → sender, delivery → receiver).
  useEffect(() => {
    setName(""); setPhone(""); setEmail("");
    if (!stop?.orderId) return;
    let live = true;
    (async () => {
      const { data } = await supabase.from("orders").select("sender, receiver").eq("id", stop.orderId!).maybeSingle();
      if (!live || !data) return;
      const c: any = String(stop.type ?? "").startsWith("del") ? data.receiver : data.sender;
      if (c?.name) setName(String(c.name).split(/\s+/)[0]);
      if (c?.phone) setPhone(String(c.phone));
      if (c?.email) setEmail(String(c.email));
    })();
    return () => { live = false; };
  }, [stop?.orderId, stop?.type, target]);

  const base = () => ({ action: "send", registration: target!.registration, stop: stop ? { saved_route_id: stop.saved_route_id, date: stop.date, stop_index: stop.stop_index } : undefined });

  const send = async () => {
    if (!target || sending) return;
    if (!phone.trim() && !email.trim()) { toast.error("Add a phone number or email"); return; }
    setSending(true);
    try {
      const data = await invokeEta({ ...base(), name, phone, email });
      const via = [data?.whatsapp && "WhatsApp", data?.email && "email"].filter(Boolean).join(" and ");
      toast.success(`ETA link sent by ${via}`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    if (!target || sending) return;
    setSending(true);
    try {
      const data = await invokeEta({ ...base(), copy: true });
      await navigator.clipboard.writeText(data.url);
      toast.success("Link copied");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o && !sending) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send ETA link · {stop ? stop.label : target?.registration}</DialogTitle>
          <DialogDescription>
            {stop
              ? "Sends a live tracking link showing the van coming to this stop and its ETA (drive time plus 15 minutes for each stop before it). Works until the end of today."
              : "Sends a link showing where the van is, its road route back to the depot, miles left and ETA. It updates live and works for 12 hours."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="eta-name">Name (optional)</Label><Input id="eta-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="eta-phone">WhatsApp number</Label><Input id="eta-phone" type="tel" placeholder="07…" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="eta-email">Email</Label><Input id="eta-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={copy} disabled={sending}><Copy className="h-4 w-4" /> Copy link</Button>
          <Button onClick={send} disabled={sending}>
            {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Send className="h-4 w-4" /> Send</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
