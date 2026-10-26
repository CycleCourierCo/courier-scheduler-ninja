import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle2, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { colouredMarkerIcon } from "@/lib/mapMarkers";
import { routeDepotIcon } from "@/components/scheduling/RouteMapPrimitives";
import { decodePolyline } from "@/services/routeGenerationService";
import { tokenColour } from "@/components/fleet/RouteOverlay";
import BrandLogo from "@/components/BrandLogo";

type Pos = { lat: number; lon: number; at: string };
interface DepotData {
  kind?: "depot";
  position: Pos;
  depot: { lat: number; lon: number; address: string };
  route: { polyline: string; miles: number; minutes: number; eta: string } | null;
}
interface StopData {
  kind: "stop";
  registration: string; driver: string | null;
  stop: { lat: number; lon: number; type: string };
  position: Pos | null;
  done?: boolean; unavailable?: boolean;
  route?: { polyline: string; miles: number; minutes: number; eta: string; stopsBefore: number };
}

function Fit({ pts }: { pts: [number, number][] }) {
  const map = useMap();
  const key = pts.map((p) => p.join(",")).join("|");
  useEffect(() => { if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 }); }, [key, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function StopView({ d }: { d: StopData }) {
  const line = d.route ? decodePolyline(d.route.polyline) : [];
  const pts: [number, number][] = [[d.stop.lat, d.stop.lon], ...(d.position ? [[d.position.lat, d.position.lon] as [number, number]] : [])];
  const verb = d.stop.type.startsWith("del") ? "delivery" : "collection";
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <div className="absolute inset-0 z-0">
        <MapContainer center={[d.stop.lat, d.stop.lon]} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Fit pts={line.length ? line : pts} />
          {line.length > 1 && <Polyline positions={line} pathOptions={{ color: tokenColour("--foreground"), weight: 6, opacity: 0.85 }} />}
          {d.position && !d.done && <Marker position={[d.position.lat, d.position.lon]} icon={colouredMarkerIcon("black")} />}
          <Marker position={[d.stop.lat, d.stop.lon]} icon={colouredMarkerIcon("green")} />
        </MapContainer>
      </div>
      <header className="absolute right-3 top-3 z-10 rounded-full border bg-card px-3 py-1.5 shadow-sm">
        <BrandLogo compact withWordmark />
      </header>
      <section className="absolute inset-x-0 bottom-0 z-10 rounded-t-2xl border-t bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-lg">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" />
        {d.done ? (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-primary" />
            <div><div className="text-xl font-bold">Your {verb} is done</div><div className="text-sm text-muted-foreground">The driver has been to your address.</div></div>
          </div>
        ) : d.route ? (
          <>
            <div className="text-sm text-muted-foreground">Arriving around</div>
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-4xl font-extrabold tabular-nums">{format(new Date(d.route.eta), "HH:mm")}</div>
              <div className="text-right text-sm"><div className="font-semibold">{d.route.minutes} min</div><div className="text-muted-foreground">{d.route.miles.toFixed(1)} mi away</div></div>
            </div>
            <div className="mt-2 text-sm">{d.route.stopsBefore === 0 ? "You're the next stop" : `${d.route.stopsBefore} stop${d.route.stopsBefore === 1 ? "" : "s"} before yours`}</div>
          </>
        ) : (
          <div><div className="text-xl font-bold">On the way</div><div className="text-sm text-muted-foreground">We can't see the van's location right now. Check back in a few minutes.</div></div>
        )}
        <div className="mt-4 flex items-center gap-3 border-t pt-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"><Truck className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="font-semibold">{d.driver ?? "Your driver"}</div>
            <div className="font-mono text-xs text-muted-foreground">{d.registration}</div>
          </div>
          {d.position && <div className="ml-auto text-right text-xs text-muted-foreground">Updated {formatDistanceToNow(new Date(d.position.at), { addSuffix: true })}</div>}
        </div>
      </section>
    </div>
  );
}

function DepotView({ d }: { d: DepotData }) {
  const line = d.route ? decodePolyline(d.route.polyline) : [[d.position.lat, d.position.lon], [d.depot.lat, d.depot.lon]] as [number, number][];
  return (
    <>
      <div className="grid grid-cols-3 gap-2 p-3 text-center">
        <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">ETA at depot</div><div className="text-xl font-semibold">{d.route ? format(new Date(d.route.eta), "HH:mm") : "—"}</div></div>
        <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">Miles to go</div><div className="text-xl font-semibold">{d.route ? d.route.miles.toFixed(1) : "—"}</div></div>
        <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">Drive time</div><div className="text-xl font-semibold">{d.route ? `${d.route.minutes} min` : "—"}</div></div>
      </div>
      <p className="px-3 pb-2 text-xs text-muted-foreground">Van location updated {formatDistanceToNow(new Date(d.position.at), { addSuffix: true })}. Heading to {d.depot.address}.</p>
      <div className="flex-1 min-h-[60vh]">
        <MapContainer center={[d.position.lat, d.position.lon]} zoom={11} style={{ height: "100%", width: "100%", minHeight: "60vh" }}>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Fit pts={line} />
          <Polyline positions={line} pathOptions={{ color: tokenColour("--primary"), weight: 5, opacity: 0.85 }} />
          <Marker position={[d.position.lat, d.position.lon]} icon={colouredMarkerIcon("green")} />
          <Marker position={[d.depot.lat, d.depot.lon]} icon={routeDepotIcon} />
        </MapContainer>
      </div>
    </>
  );
}

export default function EtaPage() {
  const { token } = useParams();
  const q = useQuery({
    queryKey: ["eta", token],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("eta-link", { body: { action: "view", token } });
      if (error) {
        let msg = "This link isn't available.";
        try { const b = await (error as any).context?.json(); if (b?.error) msg = b.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      return data as DepotData | StopData;
    },
    refetchInterval: 120_000,
    retry: false,
  });
  const d = q.data;
  if (d?.kind === "stop") return <StopView d={d} />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <BrandLogo compact withWordmark />
        <span className="font-semibold">Van ETA</span>
      </header>
      {q.isLoading && <p className="p-4 text-sm text-muted-foreground">Finding the van…</p>}
      {q.error && <p className="p-4 text-sm text-destructive">{(q.error as Error).message}</p>}
      {d && <DepotView d={d as DepotData} />}
    </div>
  );
}
