import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { colouredMarkerIcon } from "@/lib/mapMarkers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DEPOT_LOCATION } from "@/constants/depot";
import { OrderData } from "@/pages/JobScheduling";
import { extractHeatPoints, isLegViableOnDate } from "./heatJobPoints";
import HeatLayer from "./HeatLayer";

interface ViableJobsHeatMapProps {
  orders: OrderData[];
  jobTypeFilter?: "all" | "collection" | "delivery";
  selectedDate: Date;
  onSelectedDateChange: (date: Date) => void;
}

const VIABLE_GRADIENT = {
  0.3: "#2A81CB",
  0.6: "#2AAD27",
  1.0: "#CB2B3E",
};

const ViableJobsHeatMap: React.FC<ViableJobsHeatMapProps> = ({
  orders,
  jobTypeFilter = "all",
  selectedDate,
  onSelectedDateChange,
}) => {
  const ordersById = useMemo(() => {
    const m = new Map<string, OrderData>();
    orders.forEach((o) => m.set(o.id, o));
    return m;
  }, [orders]);

  const points = useMemo(() => {
    const all = extractHeatPoints(orders, {
      includeCollections: jobTypeFilter !== "delivery",
      includeDeliveries: jobTypeFilter !== "collection",
    });
    return all.filter((p) => {
      const order = ordersById.get(p.orderId);
      return order ? isLegViableOnDate(order, p.type, selectedDate) : false;
    });
  }, [orders, ordersById, jobTypeFilter, selectedDate]);

  const heatPoints = useMemo(
    () => points.map((p) => ({ lat: p.lat, lon: p.lon, weight: Math.min(1, 0.4 + p.bikeQuantity * 0.2) })),
    [points]
  );

  const collections = points.filter((p) => p.type === "collection").length;
  const deliveries = points.filter((p) => p.type === "delivery").length;
  const bikes = points.reduce((s, p) => s + p.bikeQuantity, 0);

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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {format(selectedDate, "EEE d MMM yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && onSelectedDateChange(d)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Badge variant="outline" className="border-green-600 text-green-700 bg-green-50">
          {collections} viable collection{collections !== 1 ? "s" : ""}
        </Badge>
        <Badge variant="outline" className="border-red-600 text-red-700 bg-red-50">
          {deliveries} viable deliver{deliveries !== 1 ? "ies" : "y"}
        </Badge>
        <Badge variant="secondary" className="ml-auto">
          {bikes} bike{bikes !== 1 ? "s" : ""}
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

          <HeatLayer points={heatPoints} gradient={VIABLE_GRADIENT} />

          <Marker position={[DEPOT_LOCATION.lat, DEPOT_LOCATION.lon]} icon={colouredMarkerIcon("black")}>
            <Popup>
              <div className="p-2">
                <p className="font-semibold">Depot</p>
                <p className="text-sm text-muted-foreground">{DEPOT_LOCATION.address}</p>
              </div>
            </Popup>
          </Marker>

          {points.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lon]}
              icon={colouredMarkerIcon(p.type === "collection" ? "green" : "red")}
            >
              <Popup>
                <div className="p-2">
                  <p className="font-semibold">
                    {p.type === "collection" ? "Collection" : "Delivery"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Viable on {format(selectedDate, "EEE d MMM")}
                  </p>
                  <p className="text-xs text-muted-foreground">Bikes: {p.bikeQuantity}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.ageDays === 0 ? "Booked today" : `Booked ${p.ageDays} day${p.ageDays === 1 ? "" : "s"} ago`}
                  </p>
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
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default ViableJobsHeatMap;
