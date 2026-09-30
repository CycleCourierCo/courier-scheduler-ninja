import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { colouredMarkerIcon, type MarkerColour } from "@/lib/mapMarkers";

export interface MapLeg {
  key: string;
  trackingNumber: string | null;
  customerName: string;
  bikeLabel: string;
  legType: "collection" | "delivery";
  dates: string[];
  daysLeft: number;
  lat: number;
  lng: number;
}

const colourFor = (daysLeft: number): MarkerColour =>
  daysLeft < 0 ? "red" : daysLeft === 0 ? "orange" : daysLeft === 1 ? "gold" : "blue";

const LEGEND: { colour: MarkerColour; hex: string; label: string }[] = [
  { colour: "red", hex: "#CB2B3E", label: "Expired" },
  { colour: "orange", hex: "#CB8427", label: "Last date today" },
  { colour: "gold", hex: "#FFD326", label: "Last date tomorrow" },
  { colour: "blue", hex: "#2A81CB", label: "Last date in 2–3 days" },
];

const FitBounds = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11);
    } else {
      map.fitBounds(L.latLngBounds(points).pad(0.25));
    }
  }, [map, points]);
  return null;
};

const formatDay = (key: string) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

const urgencyText = (daysLeft: number) =>
  daysLeft < 0
    ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} expired`
    : daysLeft === 0
      ? "Last day today"
      : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;

const ExpiringDatesMap = ({ legs }: { legs: MapLeg[] }) => {
  const points = useMemo(
    () => legs.map((l) => [l.lat, l.lng] as [number, number]),
    [legs],
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {LEGEND.map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className="inline-block h-3 w-3 rounded-full border border-black/20"
              style={{ backgroundColor: item.hex }}
            />
            {item.label}
          </span>
        ))}
      </div>
      <div className="h-[360px] w-full overflow-hidden rounded-lg border bg-card">
        <MapContainer
          center={[53.4, -1.9]}
          zoom={6}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <FitBounds points={points} />
          {legs.map((leg) => (
            <Marker
              key={leg.key}
              position={[leg.lat, leg.lng]}
              icon={colouredMarkerIcon(colourFor(leg.daysLeft))}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <p className="font-semibold">
                    {leg.trackingNumber ?? "No tracking number"}
                  </p>
                  <p className="text-sm">{leg.customerName}</p>
                  <p className="text-xs text-muted-foreground">{leg.bikeLabel}</p>
                  <p className="mt-1 text-xs font-medium">
                    {leg.legType === "collection" ? "Collection" : "Delivery"} ·{" "}
                    {urgencyText(leg.daysLeft)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {leg.dates.map(formatDay).join(" · ")}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default ExpiringDatesMap;
