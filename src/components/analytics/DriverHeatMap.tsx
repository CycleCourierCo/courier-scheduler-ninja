import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import type { HeatPoint } from "@/services/driverAnalyticsService";

interface Props {
  points: HeatPoint[];
}

type Filter = "all" | "pickup" | "delivery";

// ~2km grid cells (0.02 deg lat ≈ 2.2km)
const CELL = 0.02;

// Cool -> hot intensity stops (literal colours required by Maps overlays)
const RAMP = ["#3b82f6", "#22c55e", "#eab308", "#f97316", "#ef4444"];

interface Cell {
  lat: number;
  lng: number;
  count: number;
}

function bucket(points: HeatPoint[]): Cell[] {
  const map = new Map<string, Cell>();
  for (const p of points) {
    if (typeof p.lat !== "number" || typeof p.lng !== "number") continue;
    const la = Math.round(p.lat / CELL) * CELL;
    const ln = Math.round(p.lng / CELL) * CELL;
    const key = `${la.toFixed(3)}:${ln.toFixed(3)}`;
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { lat: la, lng: ln, count: 1 });
  }
  return Array.from(map.values());
}

const DriverHeatMap = ({ points }: Props) => {
  const { ready, error } = useGoogleMaps(["geometry"]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const circlesRef = useRef<any[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [drawError, setDrawError] = useState<Error | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? points : points.filter((p) => p.type === filter)),
    [points, filter],
  );

  const cells = useMemo(() => bucket(filtered), [filtered]);

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const g = (window as any).google;
    if (!g?.maps) return;

    try {
      if (!mapRef.current) {
        mapRef.current = new g.maps.Map(containerRef.current, {
          center: { lat: 52.9, lng: -1.9 },
          zoom: 6,
          streetViewControl: false,
          mapTypeControl: false,
        });
      }

      circlesRef.current.forEach((c) => c.setMap(null));
      circlesRef.current = [];

      if (cells.length === 0) return;

      const max = Math.max(...cells.map((c) => c.count));
      const bounds = new g.maps.LatLngBounds();

      cells.forEach((cell) => {
        const t = max <= 1 ? 0 : (cell.count - 1) / (max - 1);
        const colour = RAMP[Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1)))];
        const circle = new g.maps.Circle({
          map: mapRef.current,
          center: { lat: cell.lat, lng: cell.lng },
          radius: 2500 + t * 6000,
          strokeWeight: 0,
          fillColor: colour,
          fillOpacity: 0.28 + t * 0.35,
          clickable: false,
        });
        circlesRef.current.push(circle);
        bounds.extend(new g.maps.LatLng(cell.lat, cell.lng));
      });

      mapRef.current.fitBounds(bounds);
      setDrawError(null);
    } catch (e) {
      setDrawError(e instanceof Error ? e : new Error("Map failed to render"));
    }
  }, [ready, cells]);

  useEffect(() => {
    return () => {
      circlesRef.current.forEach((c) => c.setMap(null));
      circlesRef.current = [];
    };
  }, []);

  const shownError = error ?? drawError;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">Stop Heat Map</CardTitle>
            <CardDescription>Where this driver's stops happened ({points.length} recorded stops)</CardDescription>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["all", "pickup", "delivery"] as Filter[]).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "pickup" ? "Collections" : "Deliveries"}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {shownError ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Map unavailable: {shownError.message}</div>
        ) : points.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No stop coordinates recorded in this period</div>
        ) : (
          <>
            <div ref={containerRef} className="h-[320px] sm:h-[420px] w-full rounded-md bg-muted" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Fewer stops</span>
              <div className="flex h-2 flex-1 max-w-[160px] overflow-hidden rounded-full">
                {RAMP.map((c) => (
                  <span key={c} className="flex-1" style={{ backgroundColor: c }} />
                ))}
              </div>
              <span>More stops</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DriverHeatMap;
