import { useRef, useState } from "react";
import { toast } from "sonner";
import { QrCode, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQrScanner } from "@/hooks/useQrScanner";
import { normaliseBayDetail, parseScannedRef } from "@/lib/labelScan";
import BayScanner from "@/components/scan/BayScanner";
import { useBayOverrideConfirm } from "@/components/loading/BayOverrideDialog";
import { overrideBaySlot } from "@/lib/bayOverride";
import { getCollectionPhotos } from "@/utils/collectionPhotos";

/** Two-step allocation: scan the bike label, then the bay QR. Saves through label_scan_action. */
export function ScanToBaySection({ onSaved }: { onSaved?: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [typed, setTyped] = useState("");
  const [bike, setBike] = useState<{ id: string; ref: string; name: string; brand?: string; model?: string; type?: string; qty?: number; receiver?: string; photo?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const { ask: askOverride, dialog } = useBayOverrideConfirm();

  const pickBike = async (raw: string) => {
    const ref = parseScannedRef(raw);
    if (!ref || busy.current) return;
    busy.current = true;
    const { data, error } = await supabase.from("orders").select("id, tracking_number, sender, receiver, bike_brand, bike_model, bike_type, bike_quantity, tracking_events, shipday_pickup_id").eq("tracking_number", ref).maybeSingle();
    busy.current = false;
    if (error || !data) return toast.error(`No order found for ${ref}`);
    navigator.vibrate?.(60); setOn(false);
    const d: any = data;
    setBike({ id: d.id, ref: d.tracking_number ?? ref, name: d.sender?.name ?? "", brand: d.bike_brand ?? "", model: d.bike_model ?? "",
      type: d.bike_type ?? "", qty: d.bike_quantity ?? 1, receiver: d.receiver?.name ?? "",
      photo: getCollectionPhotos(d.tracking_events, d.shipday_pickup_id ?? null)[0] });
  };
  useQrScanner(on && !bike, video, pickBike, () => setOn(false));

  const save = async (rawBay: string) => {
    if (!bike) return;
    const bay = normaliseBayDetail(rawBay);
    if (!bay) { toast.error("Bay not recognised — use a letter and slot, e.g. B2"); return; }
    setSaving(true);
    let { data, error } = await supabase.rpc("label_scan_action" as any, { p_order_id: bike.id, p_action: "bay", p_detail: bay });
    if (error && /already occupied/i.test(error.message)) {
      const [b, p] = bay.toUpperCase().split("-");
      const pos = Number(p);
      if (b && Number.isFinite(pos)) {
        const { data: occ } = await supabase.from("orders").select("tracking_number, sender, bikeBrand:bike_brand, bikeModel:bike_model")
          .contains("storage_locations", [{ bay: b, position: pos }]).neq("id", bike.id).limit(1);
        const o: any = occ?.[0];
        const label = o ? [o.sender?.name, [o.bikeBrand, o.bikeModel].filter(Boolean).join(" "), o.tracking_number].filter(Boolean).join(" · ") : "another bike";
        if (await askOverride(`${b}${pos}`, label)) {
          try {
            await overrideBaySlot(bike.id, b, pos);
            ({ data, error } = await supabase.rpc("label_scan_action" as any, { p_order_id: bike.id, p_action: "bay", p_detail: bay }));
          } catch (e: any) { error = e; }
        } else { setSaving(false); return; }
      }
    }
    setSaving(false);
    if (error || !data) return toast.error(error?.message ?? "This bike can't be allocated (cancelled or delivered).");
    toast.success(`${bike.ref} put in bay ${bay}`);
    setBike(null); setOn(true); onSaved?.();
  };

  return (
    <Card>
      {dialog}
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
            <div className="space-y-2 rounded-md border bg-muted/40 p-3">
              {bike.photo ? (
                <a href={bike.photo} target="_blank" rel="noopener noreferrer">
                  <img src={bike.photo} alt="Collection photo" className="max-h-56 w-full rounded-md object-cover" />
                </a>
              ) : <p className="text-xs text-muted-foreground">No collection photo yet</p>}
              <p className="text-lg font-semibold">{[bike.brand, bike.model].filter(Boolean).join(" ") || "Bike"}</p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Tracking</dt><dd className="font-mono">{bike.ref}</dd>
                {bike.type && <><dt className="text-muted-foreground">Type</dt><dd>{bike.type}</dd></>}
                {(bike.qty ?? 1) > 1 && <><dt className="text-muted-foreground">Bikes</dt><dd>{bike.qty}</dd></>}
                <dt className="text-muted-foreground">Sender</dt><dd>{bike.name || "—"}</dd>
                <dt className="text-muted-foreground">Receiver</dt><dd>{bike.receiver || "—"}</dd>
              </dl>
              <Button size="sm" variant="ghost" className="w-full" onClick={() => setBike(null)}><RotateCcw className="mr-1 h-4 w-4" />Scan a different bike</Button>
            </div>
            {saving ? <p className="text-sm text-muted-foreground">Saving…</p> : <BayScanner key={bike.id} onBay={save} startWithCamera={false} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
