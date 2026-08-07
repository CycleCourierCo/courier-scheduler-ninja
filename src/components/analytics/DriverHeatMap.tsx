import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import type { HeatPoint } from "@/services/driverAnalyticsService";

interface Props {
  points: HeatPoint[];
}

type Filter = "all" | "pickup" | "delivery";

const DriverHeatMap = ({ points }: Props) => {
  const { ready, error } = useGoogleMaps(["visualization"]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(
    () => (filter === "all" ? points : points.filter((p) => p.type === filter)),
    [points, filter],
  );

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const g = (window as any).google;
    if (!g?.maps?.visualization) return;

    if (!mapRef.current) {
      mapRef.current = new g.maps.Map(containerRef.current, {
        center: { lat: 52.9, lng: -1.9 },
        zoom: 6,
        streetViewControl: false,
        mapTypeControl: false,
      });
    }

    const data = filtered.map((p) => new g.maps.LatLng(p.lat, p.lng));
    if (layerRef.current) {
      layerRef.current.setMap(null);
      layerRef.current = null;
    }
    if (data.length > 0) {
      layerRef.current = new g.maps.visualization.HeatmapLayer({
        data,
        map: mapRef.current,
        radius: 20,
        opacity: 0.75,
      });
      const bounds = new g.maps.LatLngBounds();
      data.forEach((ll: any) => bounds.extend(ll));
      mapRef.current.fitBounds(bounds);
    }
  }, [ready, filtered]);

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
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
      <CardContent>
        {error ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Map unavailable: {error.message}</div>
        ) : points.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No stop coordinates recorded in this period</div>
        ) : (
          <div ref={containerRef} className="h-[320px] sm:h-[420px] w-full rounded-md bg-muted" />
        )}
      </CardContent>
    </Card>
  );
};

export default DriverHeatMap;
