import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import DoorstepShell from "@/components/design/DoorstepShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
  r.onerror = reject;
  r.readAsDataURL(file);
});

export default function ReportLostItem() {
  const [params] = useSearchParams();
  const [f, setF] = useState({ tracking: params.get("ref") ?? "", postcode: "", itemName: "", description: "", name: "", email: "", phone: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (photo && (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 5 * 1024 * 1024)) {
      setError("Photo must be a JPG, PNG or WebP under 5 MB"); return;
    }
    setBusy(true);
    try {
      const body = { ...f, photo: photo ? { type: photo.type, data: await toBase64(photo) } : undefined };
      const { data, error: fnError } = await supabase.functions.invoke("submit-lost-item", { body });
      if (fnError) {
        const msg = await (fnError as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(msg?.error ?? "Something went wrong. Please try again.");
      }
      if (!data?.success) throw new Error(data?.error ?? "Something went wrong.");
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setBusy(false); }
  };

  if (done) return <DoorstepShell title="Report a lost item"><div className="space-y-3 text-center py-6"><CheckCircle2 className="h-10 w-10 mx-auto text-primary" /><p className="font-semibold">Thanks, we've got your report.</p><p className="text-sm text-muted-foreground">Our team will check the vans and depot and contact you by email.</p></div></DoorstepShell>;

  return <DoorstepShell title="Report a lost item">
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">Left something with your bike? Tell us and we'll search the collection van, delivery van and depot.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="tracking">Tracking number</Label><Input id="tracking" value={f.tracking} onChange={set("tracking")} placeholder="CCC754…" required maxLength={40} /></div>
        <div className="space-y-1"><Label htmlFor="postcode">Collection or delivery postcode</Label><Input id="postcode" value={f.postcode} onChange={set("postcode")} required maxLength={10} /></div>
      </div>
      <div className="space-y-1"><Label htmlFor="item">What's missing?</Label><Input id="item" value={f.itemName} onChange={set("itemName")} placeholder="e.g. Garmin mount, pedals, charger" required maxLength={200} /></div>
      <div className="space-y-1"><Label htmlFor="desc">Description</Label><Textarea id="desc" value={f.description} onChange={set("description")} placeholder="Brand, colour, where it was on the bike…" maxLength={2000} rows={4} /></div>
      <div className="space-y-1"><Label htmlFor="photo">Photo (optional)</Label><Input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setPhoto(e.target.files?.[0] ?? null)} /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1"><Label htmlFor="name">Your name</Label><Input id="name" value={f.name} onChange={set("name")} required maxLength={120} autoComplete="name" /></div>
        <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={f.email} onChange={set("email")} required maxLength={255} autoComplete="email" /></div>
        <div className="space-y-1"><Label htmlFor="phone">Phone (optional)</Label><Input id="phone" type="tel" value={f.phone} onChange={set("phone")} maxLength={40} autoComplete="tel" /></div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full h-12" disabled={busy}>{busy ? "Sending…" : "Send report"}</Button>
      <p className="text-xs text-muted-foreground">We use these details only to reunite you with your item.</p>
    </form>
  </DoorstepShell>;
}
