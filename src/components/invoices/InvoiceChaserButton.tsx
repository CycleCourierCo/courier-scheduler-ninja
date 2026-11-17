import { useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("send-invoice-chaser", { body });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try { msg = (await error.context.json()).error || msg; } catch { /* keep */ }
    }
    throw new Error(msg);
  }
  return data;
}

export default function InvoiceChaserButton({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [phone, setPhone] = useState("");
  const [preview, setPreview] = useState("");

  const start = async () => {
    setOpen(true); setLoading(true); setPreview("");
    try {
      const d = await invoke({ invoiceId });
      setPhone(d.phone || ""); setPreview(d.preview || "");
    } catch (e: any) {
      notify.error("Couldn't prepare reminder", { description: e.message }); setOpen(false);
    } finally { setLoading(false); }
  };

  const send = async () => {
    setSending(true);
    try {
      await invoke({ invoiceId, phone, send: true });
      notify.success("Reminder sent on WhatsApp");
      setOpen(false);
    } catch (e: any) {
      notify.error("Reminder not sent", { description: e.message });
    } finally { setSending(false); }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={start}>
        <MessageCircle className="mr-1 h-4 w-4" /> Chase
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send payment reminder</DialogTitle></DialogHeader>
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="chase-phone">WhatsApp number</Label>
                <Input id="chase-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" />
                {!phone && <p className="text-xs text-muted-foreground">No number on the customer's account — enter one.</p>}
              </div>
              <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">{preview}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={send} disabled={loading || sending || !phone.trim()}>{sending ? "Sending…" : "Send on WhatsApp"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
