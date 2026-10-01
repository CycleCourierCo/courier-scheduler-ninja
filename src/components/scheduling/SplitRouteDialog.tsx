import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Scissors } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { COST_PER_MILE, DRIVER_HOURLY_RATE, formatGBP } from "@/lib/routeCosts";

interface Stop { orderId: string; type: 'pickup' | 'delivery' | 'break'; lat?: number; lon?: number; contactName: string; [k: string]: any }
interface SplitRoute { jobs: Stop[]; duration_s: number; distance_m: number }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stops: Stop[];
  shiftStart: string;
  onLoad: (jobs: Stop[]) => void;
  onSave: (jobs: Stop[], name: string) => Promise<void>;
}

const cost = (s: number, m: number) => (m / 1609.34) * COST_PER_MILE + (s / 3600) * DRIVER_HOURLY_RATE;
const hm = (s: number) => { const m = Math.round(s / 60); return `${Math.floor(m / 60)}h ${m % 60}m`; };

const SplitRouteDialog: React.FC<Props> = ({ open, onOpenChange, stops, shiftStart, onLoad, onSave }) => {
  const [count, setCount] = useState(2);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ routes: SplitRoute[]; baseline: { duration_s: number; distance_m: number } | null } | null>(null);
  const [baseName, setBaseName] = useState("Split");
  const [saving, setSaving] = useState<number | null>(null);

  const max = Math.min(20, stops.length);

  const run = async () => {
    const missing = stops.filter((j) => !j.lat || !j.lon);
    if (missing.length) { toast.error(`Add coordinates first: ${missing.map((j) => j.contactName).join(', ')}`); return; }
    setBusy(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('route-optimize', {
        body: { mode: 'split', routes: count, shift_start: shiftStart, stops: stops.map((j) => ({ orderId: j.orderId, type: j.type, lat: j.lat, lon: j.lon })) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const byKey = new Map(stops.map((j) => [`${j.orderId}:${j.type}`, j]));
      if (data.unassigned?.length) {
        toast.error(`Couldn't place: ${data.unassigned.map((k: string) => byKey.get(k)?.contactName || k).join(', ')}`);
        return;
      }
      const routes: SplitRoute[] = data.routes.map((r: any) => ({
        jobs: r.order.map((k: string) => byKey.get(k)).filter(Boolean),
        duration_s: r.duration_s, distance_m: r.distance_m,
      }));
      setResult({ routes, baseline: data.baseline });
    } catch (e: any) {
      toast.error(`Couldn't split route: ${e?.message || 'unknown error'}`);
    } finally { setBusy(false); }
  };

  const total = result ? result.routes.reduce((a, r) => a + cost(r.duration_s, r.distance_m), 0) : 0;
  const baseCost = result?.baseline ? cost(result.baseline.duration_s, result.baseline.distance_m) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setResult(null); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Scissors className="h-4 w-4" /> Split route</DialogTitle>
          <DialogDescription>Share these {stops.length} stops between several vans for the lowest total cost and time.</DialogDescription>
        </DialogHeader>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="split-count">Number of routes</Label>
            <Input id="split-count" type="number" min={2} max={max} value={count}
              onChange={(e) => setCount(Math.max(2, Math.min(max, Number(e.target.value) || 2)))} className="w-28" />
          </div>
          <div className="space-y-1 flex-1">
            <Label htmlFor="split-name">Name for saved routes</Label>
            <Input id="split-name" value={baseName} onChange={(e) => setBaseName(e.target.value)} />
          </div>
          <Button onClick={run} disabled={busy || max < 2}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Scissors className="h-4 w-4 mr-2" />}
            {busy ? 'Splitting...' : 'Split'}
          </Button>
        </div>

        {result && (
          <div className="space-y-3 mt-2">
            <div className="text-sm text-muted-foreground">
              Total {formatGBP(total)}
              {baseCost !== null && ` · one route would be ${formatGBP(baseCost)} (${hm(result.baseline!.duration_s)} driving)`}
            </div>
            {result.routes.map((r, i) => (
              <div key={i} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-medium">Route {i + 1} of {result.routes.length}</div>
                  <div className="text-sm text-muted-foreground">
                    {r.jobs.length} stops · {hm(r.duration_s)} · {(r.distance_m / 1609.34).toFixed(1)} mi · {formatGBP(cost(r.duration_s, r.distance_m))}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {r.jobs.map((j) => `${j.type === 'pickup' ? 'C' : 'D'}: ${j.contactName}`).join(' → ')}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { onLoad(r.jobs); onOpenChange(false); setResult(null); }}>Load into builder</Button>
                  <Button size="sm" variant="outline" disabled={saving === i}
                    onClick={async () => { setSaving(i); try { await onSave(r.jobs, `${baseName} – ${i + 1} of ${result.routes.length}`); } finally { setSaving(null); } }}>
                    {saving === i ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Save route
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SplitRouteDialog;
