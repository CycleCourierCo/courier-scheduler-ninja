import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Truck, Warehouse, Undo2, Wrench, ExternalLink, Route } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { panelForRoles, driverScanState, type RouteToday } from "@/lib/labelScan";

const ACTION_LABEL: Record<string, string> = { bay: "Put in bay", load_van: "Loaded onto van", unload: "Unloaded to depot" };

async function position(): Promise<{ lat: number | null; lon: number | null }> {
  if (!("geolocation" in navigator)) return { lat: null, lon: null };
  return new Promise((res) => navigator.geolocation.getCurrentPosition(
    (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }), () => res({ lat: null, lon: null }), { timeout: 3000, maximumAge: 60000 }));
}

/** Staff view of a scanned label. Renders nothing for customers / signed-out visitors. */
export default function StaffScanPanel({ reference, compact }: { reference: string; compact?: boolean }) {
  const qc = useQueryClient();
  const [bay, setBay] = useState("");
  const q = useQuery({
    queryKey: ["label-lookup", reference],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return null;
      const { data, error } = await supabase.rpc("label_lookup" as any, { p_ref: reference });
      if (error) throw error;
      return data as any;
    },
    retry: false,
  });
  const act = useMutation({
    mutationFn: async (v: { action: string; detail?: string }) => {
      const { lat, lon } = await position();
      const { data, error } = await supabase.rpc("label_scan_action" as any, { p_order_id: q.data.order.id, p_action: v.action, p_detail: v.detail ?? null, p_lat: lat, p_lon: lon });
      if (error) throw error;
      if (!data) throw new Error("This bike can't be changed (cancelled or delivered).");
    },
    onSuccess: (_d, v) => { toast.success(ACTION_LABEL[v.action] ?? "Saved"); setBay(""); qc.invalidateQueries({ queryKey: ["label-lookup", reference] }); },
    onError: (e: any) => toast.error(e.message ?? "Couldn't save"),
  });

  const d = q.data;
  if (!d) return null;
  if (!d.found) return <Card className="border-destructive"><CardContent className="pt-6 text-sm">No order found for {reference}.</CardContent></Card>;

  const o = d.order;
  const panel = panelForRoles(d.roles);
  const routes: RouteToday[] = d.routes_today ?? [];
  const bays = Array.isArray(o.storage_locations) ? o.storage_locations : [];
  const where = o.loaded_onto_van ? "On a van" : bays.length ? `Bay ${bays.map((b: any) => `${b.bay}${b.position ?? ""}`).join(", ")}` : o.delivered ? "Delivered" : o.collected ? "Collected, not in a bay" : "Not collected yet";
  const warnings: string[] = [];
  if (o.status === "cancelled") warnings.push("Order is cancelled — do not load.");
  if (d.inspection && !["completed", "repaired", "approved"].includes(String(d.inspection.status))) warnings.push(`Inspection/repair still ${String(d.inspection.status).replace(/_/g, " ")}.`);
  if (d.my_registration_today && routes.length && !routes.some((r) => r.registration === d.my_registration_today)) warnings.push(`Not on your van (${d.my_registration_today}) today.`);
  const bikes = Array.isArray(o.bikes) && o.bikes.length ? o.bikes.map((b: any) => [b.brand, b.model].filter(Boolean).join(" ")).join(", ") : [o.bike_brand, o.bike_model].filter(Boolean).join(" ");
  const dState = driverScanState(routes);

  return (
    <Card className="border-primary">
      <CardContent className="space-y-3 pt-5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono font-semibold">{o.tracking_number}</span>
          <Badge variant="outline" className="capitalize">{String(o.status).replace(/_/g, " ")}</Badge>
        </div>
        <div className="text-muted-foreground">{bikes || "Bike"}</div>
        <div>{o.sender?.name} ({o.sender?.postcode}) → {o.receiver?.name} ({o.receiver?.postcode})</div>
        <div className="font-medium">Where: {where}</div>
        {routes.map((r) => (
          <div key={r.assignment_id} className="flex items-center gap-2 text-xs text-muted-foreground"><Route className="h-3 w-3" />{r.route} · {r.registration ?? "no van"} · {(r.stop_types ?? []).join(" + ")}</div>
        ))}
        {warnings.map((w) => <div key={w} className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{w}</div>)}

        {(panel === "loader" || panel === "admin") && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input value={bay} onChange={(e) => setBay(e.target.value.toUpperCase())} placeholder="Bay, e.g. A-3" className="h-12" />
              <Button className="h-12" disabled={!bay || act.isPending} onClick={() => act.mutate({ action: "bay", detail: bay })}><Warehouse className="mr-1 h-4 w-4" />Put in bay</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-12" disabled={act.isPending || o.status === "cancelled"} onClick={() => act.mutate({ action: "load_van", detail: routes[0]?.registration ?? undefined })}><Truck className="mr-1 h-4 w-4" />Load onto van</Button>
              <Button variant="outline" className="h-12" disabled={act.isPending || !o.loaded_onto_van} onClick={() => act.mutate({ action: "unload" })}><Undo2 className="mr-1 h-4 w-4" />Unload to depot</Button>
            </div>
          </div>
        )}

        {panel === "driver" && (
          dState === "not_on_route" ? <div className="rounded-md bg-muted p-2">Not on your route today — please tell the office before taking this bike.</div>
          : dState === "before_start" ? <div className="space-y-2"><div className="rounded-md bg-muted p-2">✓ This bike belongs on your van today. Stops unlock once you start the route at the depot.</div>
              <Button className="h-12 w-full" disabled={act.isPending || o.loaded_onto_van} onClick={() => act.mutate({ action: "load_van", detail: d.my_registration_today ?? undefined })}><Truck className="mr-1 h-4 w-4" />{o.loaded_onto_van ? "Loaded" : "Mark loaded on my van"}</Button></div>
          : <Button asChild className="h-12 w-full"><Link to="/driver/today">Open stop — collect / deliver with proof</Link></Button>
        )}

        {panel === "mechanic" && (
          <Button asChild className="h-12 w-full"><Link to="/bicycle-inspections"><Wrench className="mr-1 h-4 w-4" />{d.inspection ? "Open inspection" : "Start inspection"}</Link></Button>
        )}

        {panel === "admin" && !compact && (
          <Button asChild variant="outline" className="w-full"><Link to={`/orders/${o.id}`}><ExternalLink className="mr-1 h-4 w-4" />Open full order</Link></Button>
        )}

        {d.recent_scans?.length > 0 && (
          <details><summary className="cursor-pointer text-xs text-primary">Scan history</summary>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {d.recent_scans.map((s: any, i: number) => <li key={i}>{format(new Date(s.created_at), "d MMM HH:mm")} · {ACTION_LABEL[s.action] ?? s.action}{s.detail ? ` ${s.detail}` : ""} · {s.by_name ?? s.role}</li>)}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
