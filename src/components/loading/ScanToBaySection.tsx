import { useRef, useState } from "react";
import { toast } from "sonner";
import { QrCode, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQrScanner } from "@/hooks/useQrScanner";
import { parseScannedRef } from "@/lib/labelScan";
import BayScanner from "@/components/scan/BayScanner";

/** Two-step allocation: scan the bike label, then the bay QR. Saves through label_scan_action. */
export function ScanToBaySection({ onSaved }: { onSaved?: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [typed, setTyped] = useState("");
  const [bike, setBike] = useState<{ id: string; ref: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  const pickBike = async (raw: string) => {
    const ref = parseScannedRef(raw);
    if (!ref || busy.current) return;
    busy.current = true;
    const { data, error } = await supabase.from("orders").select("id, tracking_number, sender").eq("tracking_number", ref).maybeSingle();
    busy.current = false;
    if (error || !data) return toast.error(`No order found for ${ref}`);
    navigator.vibrate?.(60); setOn(false);
    setBike({ id: data.id, ref: data.tracking_number ?? ref, name: (data.sender as any)?.name ?? "" });
  };
  useQrScanner(on && !bike, video, pickBike, () => setOn(false));

  const save = async (bay: string) => {
    if (!bike) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("label_scan_action" as any, { p_order_id: bike.id, p_action: "bay", p_detail: bay });
    setSaving(false);
    if (error || !data) return toast.error(error?.message ?? "This bike can't be allocated (cancelled or delivered).");
    toast.success(`${bike.ref} put in bay ${bay}`);
    setBike(null); setOn(true); onSaved?.();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" />Scan to bay</CardTitle></CardHeader>
      <CardContent className="mx-auto max-w-md space-y-3">
        <ol className="flex gap-2 text-xs">
          <li className={`flex-1 rounded-md border p-2 text-center ${!bike ? "border-primary font-medium" : "text-muted-foreground"}`}>1. Scan bike label</li>
          <li className={`flex-1 rounded-md border p-2 text-center ${bike ? "border-primary font-medium" : "text-muted-foreground"}`}>2. Scan bay QR</li>
        </ol>
        {!bike ? (
          <>
            {on && <video ref={video} playsInline muted className="aspect-square w-full rounded-md bg-muted object-cover" />}
            <Button className="h-12 w-full" variant={on ? "outline" : "default"} onClick={() => setOn(!on)}>{on ? "Stop camera" : "Start scanning"}</Button>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); pickBike(typed); setTyped(""); }}>
              <Input className="h-12" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type CCC number" />
              <Button className="h-12" type="submit" disabled={!typed}>Go</Button>
            </form>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md bg-muted p-2 text-sm">
              <span><span className="font-mono font-semibold">{bike.ref}</span> {bike.name}</span>
              <Button size="sm" variant="ghost" onClick={() => setBike(null)}><RotateCcw className="mr-1 h-4 w-4" />Change</Button>
            </div>
            {saving ? <p className="text-sm text-muted-foreground">Saving…</p> : <BayScanner key={bike.id} onBay={save} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
