import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQrScanner } from "@/hooks/useQrScanner";
import { normaliseBayDetail, parseBayCode } from "@/lib/labelScan";

/** Opens the camera and waits for a bay QR; typed bay (e.g. A-3) also accepted. */
export default function BayScanner({ onBay, onCancel, startWithCamera = true }: { onBay: (bay: string) => void; onCancel?: () => void; startWithCamera?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(startWithCamera);
  const [letter, setLetter] = useState("");
  const [slot, setSlot] = useState("");
  const done = useRef(false);
  useQrScanner(on, video, (text) => {
    const bay = parseBayCode(text);
    if (!bay || done.current) return;
    done.current = true; navigator.vibrate?.(60); setOn(false); onBay(bay);
  }, () => setOn(false));
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Scan the bay QR or type it in</p>
      {on && <video ref={video} playsInline muted className="aspect-square w-full rounded-md bg-muted object-cover" />}
      <Button type="button" variant={on ? "outline" : "default"} className="h-12 w-full" onClick={() => { done.current = false; setOn(!on); }}>{on ? "Stop camera" : "Scan bay QR"}</Button>
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); const b = normaliseBayDetail(slot ? `${letter}-${slot}` : letter); if (b) onBay(b); }}>
        <div className="flex-1"><label className="text-xs text-muted-foreground" htmlFor="bay-letter">Bay</label>
          <Input id="bay-letter" className="h-12 text-center uppercase" value={letter} maxLength={8} placeholder="A" onChange={(e) => setLetter(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} /></div>
        <div className="flex-1"><label className="text-xs text-muted-foreground" htmlFor="bay-slot">Number</label>
          <Input id="bay-slot" className="h-12 text-center" inputMode="numeric" value={slot} maxLength={3} placeholder="3" onChange={(e) => setSlot(e.target.value.replace(/\D/g, ""))} /></div>
        <Button className="h-12" type="submit" disabled={!letter}>Use</Button>
      </form>
      {onCancel && <Button variant="ghost" className="w-full" onClick={onCancel}>Cancel</Button>}
    </div>
  );
}
