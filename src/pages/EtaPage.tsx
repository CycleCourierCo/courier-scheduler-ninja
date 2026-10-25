import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { colouredMarkerIcon } from "@/lib/mapMarkers";
import { routeDepotIcon } from "@/components/scheduling/RouteMapPrimitives";
import { decodePolyline } from "@/services/routeGenerationService";
import { tokenColour } from "@/components/fleet/RouteOverlay";
import BrandLogo from "@/components/BrandLogo";

interface EtaData {
  position: { lat: number; lon: number; at: string };
  depot: { lat: number; lon: number; address: string };
  route: { polyline: string; miles: number; minutes: number; eta: string } | null;
}

function Fit({ pts }: { pts: [number, number][] }) {
  const map = useMap();
  useEffect(() => { if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 14 }); }, [pts.length, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
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
      return data as EtaData;
    },
    refetchInterval: 120_000,
    retry: false,
  });
  const d = q.data;
  const line = d?.route ? decodePolyline(d.route.polyline) : d ? [[d.position.lat, d.position.lon], [d.depot.lat, d.depot.lon]] as [number, number][] : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <BrandLogo compact withWordmark />
        <span className="font-semibold">Van ETA</span>
      </header>
      {q.isLoading && <p className="p-4 text-sm text-muted-foreground">Finding the van…</p>}
      {q.error && <p className="p-4 text-sm text-destructive">{(q.error as Error).message}</p>}
      {d && (
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
      )}
    </div>
  );
}
