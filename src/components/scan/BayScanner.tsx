import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQrScanner } from "@/hooks/useQrScanner";
import { parseBayCode } from "@/lib/labelScan";

/** Opens the camera and waits for a bay QR; typed bay (e.g. A-3) also accepted. */
export default function BayScanner({ onBay, onCancel }: { onBay: (bay: string) => void; onCancel?: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(true);
  const [typed, setTyped] = useState("");
  const done = useRef(false);
  useQrScanner(on, video, (text) => {
    const bay = parseBayCode(text);
    if (!bay || done.current) return;
    done.current = true; navigator.vibrate?.(60); setOn(false); onBay(bay);
  }, () => setOn(false));
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Scan the bay location QR</p>
      {on && <video ref={video} playsInline muted className="aspect-square w-full rounded-md bg-muted object-cover" />}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const b = typed.trim().toUpperCase(); if (/^[A-Z0-9]{1,8}(-\d{1,3})?$/.test(b)) onBay(b); }}>
        <Input className="h-12" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} placeholder="Or type bay, e.g. A-3" />
        <Button className="h-12" type="submit" disabled={!typed}>Use</Button>
      </form>
      {onCancel && <Button variant="ghost" className="w-full" onClick={onCancel}>Cancel</Button>}
    </div>
  );
}
