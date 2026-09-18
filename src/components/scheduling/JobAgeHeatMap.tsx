import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { colouredMarkerIcon } from "@/lib/mapMarkers";
import { Badge } from "@/components/ui/badge";
import { DEPOT_LOCATION } from "@/constants/depot";
import { OrderData } from "@/pages/JobScheduling";
import { AGE_BANDS, bandForAge, extractHeatPoints } from "./heatJobPoints";
import HeatLayer from "./HeatLayer";

interface JobAgeHeatMapProps {
  orders: OrderData[];
  jobTypeFilter?: "all" | "collection" | "delivery";
}

const AGE_GRADIENT = {
  0.2: "#2AAD27",
  0.45: "#FFD326",
  0.7: "#CB8427",
  1.0: "#CB2B3E",
};

const JobAgeHeatMap: React.FC<JobAgeHeatMapProps> = ({ orders, jobTypeFilter = "all" }) => {
  const points = useMemo(
    () =>
      extractHeatPoints(orders, {
        includeCollections: jobTypeFilter !== "delivery",
        includeDeliveries: jobTypeFilter !== "collection",
      }),
    [orders, jobTypeFilter]
  );

  const heatPoints = useMemo(
    () =>
      points.map((p) => ({
        lat: p.lat,
        lon: p.lon,
        // Older jobs burn hotter; 21+ days maxes out
        weight: Math.min(1, 0.15 + p.ageDays / 21),
      })),
    [points]
  );

  const bandCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    points.forEach((p) => {
      const band = bandForAge(p.ageDays);
      counts[band.key] = (counts[band.key] || 0) + 1;
    });
    return counts;
  }, [points]);

  const center = useMemo(() => {
    if (points.length === 0) return { lat: DEPOT_LOCATION.lat, lng: DEPOT_LOCATION.lon };
    return {
      lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
      lng: points.reduce((s, p) => s + p.lon, 0) / points.length,
    };
  }, [points]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg border">
        <span className="text-sm font-medium mr-2">Job age:</span>
        {AGE_BANDS.map((band) => (
          <Badge
            key={band.key}
            variant="outline"
            style={{ borderColor: band.colour, backgroundColor: `${band.colour}20`, color: band.colour }}
          >
            {band.label} ({bandCounts[band.key] || 0})
          </Badge>
        ))}
        <Badge variant="secondary" className="ml-auto">
          {points.length} job{points.length !== 1 ? "s" : ""} waiting
        </Badge>
      </div>

      <div className="h-[400px] w-full rounded-lg overflow-hidden border border-border">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={6}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          <HeatLayer points={heatPoints} gradient={AGE_GRADIENT} />

          <Marker position={[DEPOT_LOCATION.lat, DEPOT_LOCATION.lon]} icon={colouredMarkerIcon("black")}>
            <Popup>
              <div className="p-2">
                <p className="font-semibold">Depot</p>
                <p className="text-sm text-muted-foreground">{DEPOT_LOCATION.address}</p>
              </div>
            </Popup>
          </Marker>

          {points.map((p) => {
            const band = bandForAge(p.ageDays);
            return (
              <Marker key={p.id} position={[p.lat, p.lon]} icon={colouredMarkerIcon(band.marker)}>
                <Popup>
                  <div className="p-2">
                    <p className="font-semibold">
                      {p.type === "collection" ? "Collection" : "Delivery"}
                    </p>
                    <p className="text-xs mt-1" style={{ color: band.colour }}>
                      {p.ageDays === 0 ? "Booked today" : `Booked ${p.ageDays} day${p.ageDays === 1 ? "" : "s"} ago`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Bikes: {p.bikeQuantity}</p>
                    {p.trackingNumber && (
                      <a
                        href={`/orders/${p.orderId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline block mt-1"
                      >
                        #{p.trackingNumber}
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
};

export default JobAgeHeatMap;
