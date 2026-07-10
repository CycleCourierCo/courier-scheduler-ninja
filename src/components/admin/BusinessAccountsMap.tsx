import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const makeIcon = (color: "green" | "red" | "orange" | "blue") =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

const ICONS = {
  approved: makeIcon("green"),
  pending: makeIcon("orange"),
  rejected: makeIcon("red"),
  default: makeIcon("blue"),
};

export interface MapBusinessAccount {
  id: string;
  company_name: string | null;
  name: string | null;
  email: string | null;
  city: string | null;
  postal_code: string | null;
  account_status: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface Props {
  accounts: MapBusinessAccount[];
  height?: string;
}

const UK_CENTER: [number, number] = [54.5, -2.5];
const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined;

const BusinessAccountsMap: React.FC<Props> = ({ accounts, height = "400px" }) => {
  const mapRef = useRef<L.Map | null>(null);
  const [geocoded, setGeocoded] = useState<Record<string, { lat: number; lng: number }>>({});

  const located = useMemo(() => {
    return accounts
      .map((a) => {
        const lat = a.latitude ?? geocoded[a.id]?.lat;
        const lng = a.longitude ?? geocoded[a.id]?.lng;
        if (typeof lat === "number" && typeof lng === "number") {
          return { ...a, _lat: lat, _lng: lng };
        }
        return null;
      })
      .filter((v): v is MapBusinessAccount & { _lat: number; _lng: number } => v !== null);
  }, [accounts, geocoded]);

  // Geocode missing accounts by postcode
  useEffect(() => {
    if (!GEOAPIFY_KEY) return;
    const missing = accounts.filter(
      (a) =>
        (a.latitude == null || a.longitude == null) &&
        !geocoded[a.id] &&
        a.postal_code &&
        a.postal_code.trim().length > 0
    );
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const a of missing) {
        try {
          const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
            `${a.postal_code}, United Kingdom`
          )}&limit=1&apiKey=${GEOAPIFY_KEY}`;
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          const feat = data?.features?.[0];
          const lng = feat?.geometry?.coordinates?.[0];
          const lat = feat?.geometry?.coordinates?.[1];
          if (typeof lat === "number" && typeof lng === "number" && !cancelled) {
            setGeocoded((prev) => ({ ...prev, [a.id]: { lat, lng } }));
          }
        } catch {
          // ignore
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accounts, geocoded]);

  // Fit bounds when locations change
  useEffect(() => {
    if (mapRef.current && located.length > 0) {
      const bounds = L.latLngBounds(located.map((l) => [l._lat, l._lng] as [number, number]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [located]);

  const getIcon = (status: string | null) => {
    if (status === "approved") return ICONS.approved;
    if (status === "rejected" || status === "suspended") return ICONS.rejected;
    if (status === "pending" || !status) return ICONS.pending;
    return ICONS.default;
  };

  return (
    <div className="relative rounded-lg overflow-hidden border" style={{ height }}>
      <MapContainer
        center={UK_CENTER}
        zoom={6}
        style={{ height: "100%", width: "100%" }}
        whenCreated={(map) => {
          mapRef.current = map;
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {located.map((a) => (
          <Marker key={a.id} position={[a._lat, a._lng]} icon={getIcon(a.account_status)}>
            <Popup>
              <div className="text-sm space-y-1">
                <p className="font-semibold">{a.company_name || "Unnamed business"}</p>
                {a.name && <p>{a.name}</p>}
                {a.email && <p className="text-xs text-muted-foreground">{a.email}</p>}
                {(a.city || a.postal_code) && (
                  <p className="text-xs">
                    {a.city}
                    {a.city && a.postal_code ? ", " : ""}
                    {a.postal_code}
                  </p>
                )}
                <p className="text-xs capitalize">
                  Status: <strong>{a.account_status || "pending"}</strong>
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {located.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 pointer-events-none">
          <p className="text-sm text-muted-foreground">No business locations to display yet</p>
        </div>
      )}
    </div>
  );
};

export default BusinessAccountsMap;
