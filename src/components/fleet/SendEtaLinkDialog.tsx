import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function SendEtaLinkDialog({ registration, onClose }: { registration: string | null; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!registration || sending) return;
    if (!phone.trim() && !email.trim()) { toast.error("Add a phone number or email"); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("eta-link", { body: { action: "send", registration, name, phone, email } });
      if (error) {
        let msg = "Couldn't send the ETA link";
        try { const b = await (error as any).context?.json(); if (b?.error) msg = b.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const via = [data?.whatsapp && "WhatsApp", data?.email && "email"].filter(Boolean).join(" and ");
      toast.success(`ETA link sent by ${via}`);
      setName(""); setPhone(""); setEmail("");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={!!registration} onOpenChange={(o) => { if (!o && !sending) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send ETA link · {registration}</DialogTitle>
          <DialogDescription>Sends a link showing where the van is, its road route back to the depot, miles left and ETA. It updates live and works for 12 hours.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="eta-name">Name (optional)</Label><Input id="eta-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="eta-phone">WhatsApp number</Label><Input id="eta-phone" type="tel" placeholder="07…" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="eta-email">Email</Label><Input id="eta-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={send} disabled={sending}>
            {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Send className="h-4 w-4" /> Send ETA link</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
