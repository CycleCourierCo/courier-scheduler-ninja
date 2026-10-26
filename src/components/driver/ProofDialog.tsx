import { useEffect, useRef, useState } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Camera as CameraIcon, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isNative, saveProof, currentPosition } from "@/lib/driverApp/native";
import type { DriverStop } from "@/lib/driverApp/stops";

function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const drawn = useRef(false);

  useEffect(() => {
    const c = ref.current!; const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio; c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!; ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.strokeStyle = getComputedStyle(c).color;
  }, []);

  const pt = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  return (
    <div className="space-y-1">
      <canvas
        ref={ref}
        className="h-36 w-full touch-none rounded-md border bg-card text-foreground"
        onPointerDown={(e) => { drawing.current = true; const [x, y] = pt(e); const ctx = ref.current!.getContext("2d")!; ctx.beginPath(); ctx.moveTo(x, y); }}
        onPointerMove={(e) => { if (!drawing.current) return; const [x, y] = pt(e); const ctx = ref.current!.getContext("2d")!; ctx.lineTo(x, y); ctx.stroke(); drawn.current = true; }}
        onPointerUp={() => { drawing.current = false; if (drawn.current) onChange(ref.current!.toDataURL("image/png")); }}
      />
      <Button type="button" variant="ghost" size="sm" onClick={() => {
        const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); drawn.current = false; onChange(null);
      }}>Clear signature</Button>
    </div>
  );
}

const readFile = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });

export function ProofDialog({ stop, driverId, open, onOpenChange, onSaved }: {
  stop: DriverStop | null; driverId: string; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setPhotos([]); setSignature(null); setName(""); setNote(""); } }, [open]);

  const takePhoto = async () => {
    if (!isNative()) { fileRef.current?.click(); return; }
    try {
      const p = await Camera.getPhoto({ quality: 60, width: 1600, resultType: CameraResultType.DataUrl, source: CameraSource.Camera });
      if (p.dataUrl) setPhotos((x) => [...x, p.dataUrl!]);
    } catch { /* cancelled */ }
  };

  const save = async () => {
    if (!stop?.orderId) return;
    if (photos.length === 0 && !signature) { toast.error("Add at least one photo or a signature"); return; }
    setSaving(true);
    try {
      const pos = await currentPosition();
      const left = await saveProof({
        id: crypto.randomUUID(), orderId: stop.orderId, stopType: stop.type, photos, signature,
        recipientName: name.trim(), note: note.trim(), lat: pos?.lat ?? null, lng: pos?.lng ?? null,
        capturedAt: new Date().toISOString(),
      }, driverId);
      toast.success(left > 0 ? "Saved on your phone — it'll upload when you're back online" : "Proof saved");
      onSaved(); onOpenChange(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Proof of {stop?.type === "pickup" ? "collection" : "delivery"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Photos</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-md object-cover" />
                  <button type="button" aria-label="Remove photo" className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground" onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                </div>
              ))}
              <Button type="button" variant="outline" className="h-20 w-20 flex-col" onClick={takePhoto}><CameraIcon className="h-5 w-5" />Photo</Button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) { const d = await readFile(f); setPhotos((x) => [...x, d]); } e.target.value = "";
              }} />
            </div>
          </div>
          <div className="space-y-1"><Label>Signature</Label><SignaturePad onChange={setSignature} /></div>
          <div className="space-y-1"><Label htmlFor="pod-name">Name of person</Label><Input id="pod-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="pod-note">Note</Label><Textarea id="pod-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter><Button className="h-12 w-full" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save proof</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
