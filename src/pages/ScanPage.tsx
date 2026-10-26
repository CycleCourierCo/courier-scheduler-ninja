import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, CameraOff, X } from "lucide-react";
import StaffScanPanel from "@/components/scan/StaffScanPanel";
import { parseScannedRef } from "@/lib/labelScan";

export default function ScanPage() {
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [typed, setTyped] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [vanMode, setVanMode] = useState(false);
  const [batch, setBatch] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const last = useRef<{ ref: string; t: number }>({ ref: "", t: 0 });

  const handle = (raw: string) => {
    const ref = parseScannedRef(raw);
    if (!ref) return;
    const now = Date.now();
    if (last.current.ref === ref && now - last.current.t < 3000) return;
    last.current = { ref, t: now };
    navigator.vibrate?.(60);
    if (vanMode) setBatch((b) => (b.includes(ref) ? b : [...b, ref]));
    else setCurrent(ref);
  };

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null; let raf = 0; let stopped = false;
    const detector = "BarcodeDetector" in window ? new (window as any).BarcodeDetector({ formats: ["qr_code"] }) : null;
    const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d", { willReadFrequently: true });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream; await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          const v = video.current;
          if (v.readyState >= 2) {
            try {
              if (detector) { const codes = await detector.detect(v); if (codes[0]) handle(codes[0].rawValue); }
              else if (ctx) {
                canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0);
                const r = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
                if (r) handle(r.data);
              }
            } catch { /* keep scanning */ }
          }
          raf = window.setTimeout(tick, 250) as unknown as number;
        };
        tick();
      } catch { toast.error("Camera not available — type the CCC number instead."); setOn(false); }
    })();
    return () => { stopped = true; clearTimeout(raf); stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, vanMode]);

  const loadBatch = async () => {
    setSaving(true);
    try {
      const { data: orders, error } = await supabase.from("orders").select("id, tracking_number").in("tracking_number", batch);
      if (error) throw error;
      const ids = (orders ?? []).map((o) => o.id);
      for (const id of ids) {
        const { error: e } = await supabase.rpc("label_scan_action" as any, { p_order_id: id, p_action: "load_van" });
        if (e) throw e;
      }
      toast.success(`${ids.length} bike${ids.length === 1 ? "" : "s"} loaded${ids.length < batch.length ? ` · ${batch.length - ids.length} not found` : ""}`);
      setBatch([]);
    } catch (e: any) { toast.error(e.message ?? "Couldn't load bikes"); } finally { setSaving(false); }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-md space-y-4 p-4">
        <h1 className="text-xl font-bold">Scan a label</h1>
        <div className="flex items-center gap-2"><Switch id="van" checked={vanMode} onCheckedChange={(v) => { setVanMode(v); setCurrent(null); }} /><Label htmlFor="van">Van loading mode (scan many, save once)</Label></div>
        <div className="overflow-hidden rounded-lg bg-muted">
          {on ? <video ref={video} playsInline muted className="aspect-square w-full object-cover" /> : <div className="flex aspect-[2/1] items-center justify-center text-muted-foreground">Camera off</div>}
        </div>
        <Button className="h-12 w-full" variant={on ? "outline" : "default"} onClick={() => setOn(!on)}>{on ? <><CameraOff className="mr-2 h-4 w-4" />Stop camera</> : <><Camera className="mr-2 h-4 w-4" />Start camera</>}</Button>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); handle(typed); setTyped(""); }}>
          <Input className="h-12" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type CCC number" />
          <Button className="h-12" type="submit">Go</Button>
        </form>
        {vanMode ? (
          <Card><CardContent className="space-y-2 pt-5">
            <div className="font-medium">{batch.length} scanned</div>
            <ul className="space-y-1 text-sm">{batch.map((r) => <li key={r} className="flex items-center justify-between font-mono">✓ {r}<button aria-label={`Remove ${r}`} onClick={() => setBatch((b) => b.filter((x) => x !== r))}><X className="h-4 w-4" /></button></li>)}</ul>
            <Button className="h-12 w-full" disabled={!batch.length || saving} onClick={loadBatch}>Load {batch.length} onto van</Button>
          </CardContent></Card>
        ) : current && <StaffScanPanel key={current} reference={current} />}
      </div>
    </Layout>
  );
}
