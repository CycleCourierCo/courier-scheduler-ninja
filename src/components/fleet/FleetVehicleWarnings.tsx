import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertOctagon, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { dedupeWarnings, type FleetWarning } from "@/lib/fleet/warnings";

/**
 * Shows fleet warnings for the chosen van(s). Never blocks the choice or changes the van.
 * Continuing past a red warning is recorded once per van per screen.
 */
export default function FleetVehicleWarnings({ vehicleIds, context }: { vehicleIds: (string | null | undefined)[]; context: string }) {
  const ids = [...new Set(vehicleIds.filter(Boolean))] as string[];
  const key = ids.sort().join(",");
  const [ws, setWs] = useState<FleetWarning[]>([]);
  const [acked, setAcked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!ids.length) { setWs([]); return; }
    let live = true;
    (supabase as any).rpc("fleet_vehicle_warnings", { p_vehicle_ids: ids }).then(({ data, error }: any) => {
      if (live && !error) setWs(dedupeWarnings(data ?? []));
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!ws.length) return null;

  const ack = async (vehicleId: string) => {
    setAcked((s) => new Set(s).add(vehicleId));
    const { data: u } = await supabase.auth.getUser();
    await (supabase as any).from("fleet_route_warning_acks").insert({
      vehicle_id: vehicleId, context, acknowledged_by: u.user?.id,
      warning_codes: ws.filter((w) => w.vehicle_id === vehicleId && w.level === "red").map((w) => w.code),
    });
  };

  const redVans = [...new Set(ws.filter((w) => w.level === "red").map((w) => w.vehicle_id))];
  const style = { red: "border-destructive bg-destructive/10 text-destructive", amber: "border-status-waiting bg-status-waiting/10", grey: "border-border bg-muted text-muted-foreground" } as const;
  const Icon = { red: AlertOctagon, amber: AlertTriangle, grey: Info } as const;

  return (
    <div className="space-y-1.5" role="status">
      {ws.map((w) => {
        const I = Icon[w.level];
        return (
          <div key={`${w.vehicle_id}|${w.code}`} className={`flex gap-2 rounded-md border p-2 text-xs ${style[w.level]}`}>
            <I className="h-4 w-4 shrink-0" />
            <span><strong>{w.registration}:</strong> {w.message} <Link to={`/fleet/vehicles/${w.vehicle_id}`} className="underline" target="_blank">View van</Link></span>
          </div>
        );
      })}
      {redVans.filter((v) => !acked.has(v)).map((v) => (
        <Button key={v} type="button" size="sm" variant="outline" onClick={() => ack(v)}>
          I've checked {ws.find((w) => w.vehicle_id === v)?.registration} is safe to use — continue
        </Button>
      ))}
    </div>
  );
}
