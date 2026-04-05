import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Fuel, MapPin, Clock, CreditCard, Search, Loader2, Trophy, RefreshCw, ArrowUpDown, Database } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { geocodeAddress } from "@/utils/geocoding";
import { format, formatDistanceToNow } from "date-fns";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon
const fixLeafletIcon = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  });
};
fixLeafletIcon();

const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const blueIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface FuelStation {
  site_id: string;
  brand: string;
  name: string;
  address: string;
  postcode: string;
  latitude?: number;
  longitude?: number;
  diesel_price: number;
  last_updated: string;
  distance_miles: number;
}

const DEPOT_LAT = 52.4690197;
const DEPOT_LON = -1.8757663;
const MILES_TO_KM = 1.60934;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceToSegmentKm(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return haversineKm(px, py, ax + t * dx, ay + t * dy);
}

const FuelFinderPage: React.FC = () => {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = userProfile?.role === "admin";

  const [mode, setMode] = useState<"depot" | "route">("depot");
  const [currentLocation, setCurrentLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [fuelCardPrice, setFuelCardPrice] = useState("");
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [searchParams, setSearchParams] = useState<any>(null);
  const [sortBy, setSortBy] = useState<"price" | "distance" | "updated">("price");

  // Fetch fuel card settings
  const { data: fuelCardSettings } = useQuery({
    queryKey: ["fuel-card-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_card_settings" as any)
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data as any)?.[0] || null;
    },
  });

  // Independent cache status query — runs on mount, not gated by search
  const { data: cacheStatus, isLoading: cacheStatusLoading } = useQuery({
    queryKey: ["fuel-cache-status"],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("fuel_station_cache" as any)
        .select("cached_at", { count: "exact" })
        .not("diesel_price", "is", null)
        .order("cached_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const rows = data as any[] | null;
      return {
        stationCount: count || 0,
        latestCachedAt: rows?.[0]?.cached_at || null,
      };
    },
    enabled: !!userProfile,
  });

  useEffect(() => {
    if (fuelCardSettings?.price_per_litre) {
      setFuelCardPrice(String(fuelCardSettings.price_per_litre));
    }
  }, [fuelCardSettings]);

  // Save fuel card price
  const saveFuelCard = useMutation({
    mutationFn: async (price: number) => {
      if (fuelCardSettings?.id) {
        const { error } = await supabase
          .from("fuel_card_settings" as any)
          .update({ price_per_litre: price, updated_at: new Date().toISOString(), updated_by: userProfile?.id } as any)
          .eq("id", fuelCardSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("fuel_card_settings" as any)
          .insert({ price_per_litre: price, updated_by: userProfile?.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuel-card-settings"] });
      toast.success("Fuel card price updated");
    },
    onError: () => toast.error("Failed to save fuel card price"),
  });

  // Fetch fuel stations from cache (client-side query + distance filter)
  const { data: stationData, isLoading, isError, error: queryError, refetch } = useQuery({
    queryKey: ["fuel-stations", searchParams],
    queryFn: async () => {
      // Query cached stations directly from Supabase
      const { data: cached, error } = await supabase
        .from("fuel_station_cache" as any)
        .select("*")
        .not("diesel_price", "is", null)
        .range(0, 9999);

      if (error) throw error;

      const allStations = (cached as any[]) || [];
      
      if (allStations.length === 0) {
        return { stations: [] as FuelStation[], count: 0, cached_at: null as string | null, needs_refresh: true };
      }

      const searchMode = searchParams?.mode || "depot";
      const radiusMiles = searchMode === "depot" ? 5 : 2;
      const radiusKm = radiusMiles * MILES_TO_KM;

      const results: FuelStation[] = [];
      let latestCachedAt: string | null = null;

      for (const s of allStations) {
        if (!s.latitude || !s.longitude) continue;

        if (!latestCachedAt || s.cached_at > latestCachedAt) {
          latestCachedAt = s.cached_at;
        }

        let distKm: number;
        if (searchMode === "depot") {
          distKm = haversineKm(DEPOT_LAT, DEPOT_LON, s.latitude, s.longitude);
        } else {
          distKm = distanceToSegmentKm(
            s.latitude, s.longitude,
            searchParams.origin_lat, searchParams.origin_lon,
            searchParams.destination_lat, searchParams.destination_lon
          );
        }

        if (distKm > radiusKm) continue;

        results.push({
          site_id: s.node_id,
          brand: s.brand,
          name: s.name,
          address: s.address || "",
          postcode: s.postcode || "",
          latitude: s.latitude,
          longitude: s.longitude,
          diesel_price: Number(s.diesel_price),
          last_updated: s.last_updated || "",
          distance_miles: Math.round(distKm / MILES_TO_KM * 10) / 10,
        });
      }

      results.sort((a, b) => a.diesel_price - b.diesel_price);
      return { stations: results, count: results.length, cached_at: latestCachedAt, needs_refresh: false };
    },
    enabled: !!searchParams,
    retry: 1,
  });

  // Refresh cache mutation
  const refreshCache = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("fuel-finder", {
        body: { mode: "refresh" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Cache refreshed: ${data.stations_cached} stations updated`);
      queryClient.invalidateQueries({ queryKey: ["fuel-stations"] });
    },
    onError: (err: any) => {
      toast.error(`Refresh failed: ${err.message || "Unknown error"}`);
    },
  });

  const handleSearch = async () => {
    if (mode === "depot") {
      setSearchParams({ mode: "depot" });
      setSearchTriggered(true);
    } else {
      if (!currentLocation || !destination) {
        toast.error("Please enter both current location and destination");
        return;
      }
      toast.info("Geocoding addresses...");
      const [originCoords, destCoords] = await Promise.all([
        geocodeAddress(currentLocation),
        geocodeAddress(destination),
      ]);
      if (!originCoords || !destCoords) {
        toast.error("Could not find one or both addresses. Please try more specific addresses.");
        return;
      }
      setSearchParams({
        mode: "route",
        origin_lat: originCoords.lat,
        origin_lon: originCoords.lon,
        destination_lat: destCoords.lat,
        destination_lon: destCoords.lon,
      });
      setSearchTriggered(true);
    }
  };

  const stations = stationData?.stations || [];
  const cachedAt = cacheStatus?.latestCachedAt;
  const needsRefresh = cacheStatus ? cacheStatus.stationCount === 0 : false;

  const sortedStations = useMemo(() => {
    return [...stations].sort((a, b) => {
      if (sortBy === "price") return (a.diesel_price || 0) - (b.diesel_price || 0);
      if (sortBy === "distance") return (a.distance_miles || 0) - (b.distance_miles || 0);
      return new Date(b.last_updated || 0).getTime() - new Date(a.last_updated || 0).getTime();
    });
  }, [stations, sortBy]);

  const cheapestPrice = stations.length > 0 ? Math.min(...stations.map(s => s.diesel_price)) : null;
  const mostRecent = stations.length > 0
    ? stations.reduce((a, b) => (new Date(b.last_updated) > new Date(a.last_updated) ? b : a))
    : null;
  const cardPrice = fuelCardSettings?.price_per_litre ? Number(fuelCardSettings.price_per_litre) : null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Fuel className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fuel Finder</h1>
            <p className="text-muted-foreground">Find the cheapest diesel near you</p>
          </div>
        </div>

        {/* Admin Fuel Card Price */}
        {isAdmin && (
          <Card className="mb-6 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Fuel Card Price
              </CardTitle>
              <CardDescription>Set the current fuel card price (pence per litre) for comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label htmlFor="fuelCardPrice">Price (ppl)</Label>
                  <Input
                    id="fuelCardPrice"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 139.9"
                    value={fuelCardPrice}
                    onChange={(e) => setFuelCardPrice(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => {
                    const price = parseFloat(fuelCardPrice);
                    if (isNaN(price) || price <= 0) {
                      toast.error("Enter a valid price");
                      return;
                    }
                    saveFuelCard.mutate(price);
                  }}
                  disabled={saveFuelCard.isPending}
                >
                  {saveFuelCard.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
              {fuelCardSettings?.updated_at && (
                <p className="text-xs text-muted-foreground mt-2">
                  Last updated: {formatDistanceToNow(new Date(fuelCardSettings.updated_at), { addSuffix: true })}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Admin Refresh Cache Button */}
        {isAdmin && (
          <Card className="mb-6 border-primary/20">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Station Price Cache</p>
                  {cachedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Last refreshed: {formatDistanceToNow(new Date(cachedAt), { addSuffix: true })}
                    </p>
                  ) : (
                    <p className="text-xs text-destructive">Cache is empty — refresh required</p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshCache.mutate()}
                disabled={refreshCache.isPending}
              >
                {refreshCache.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" />Refreshing...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-1" />Refresh Prices</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Fuel card price display for non-admins */}
        {!isAdmin && cardPrice && (
          <Card className="mb-6 bg-muted/50">
            <CardContent className="py-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Fuel card price: <span className="font-semibold text-foreground">{cardPrice}p/litre</span>
              </span>
            </CardContent>
          </Card>
        )}

        {/* Search Mode */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "depot" | "route")} className="mb-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="depot" id="depot" />
                <Label htmlFor="depot" className="cursor-pointer">Start from Depot (B10 0AD)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="route" id="route" />
                <Label htmlFor="route" className="cursor-pointer">On My Route</Label>
              </div>
            </RadioGroup>

            {mode === "route" && (
              <div className="space-y-3 mb-4">
                <div>
                  <Label htmlFor="currentLocation">Current Location</Label>
                  <Input
                    id="currentLocation"
                    placeholder="e.g. B10 0AD or 123 High Street, Birmingham"
                    value={currentLocation}
                    onChange={(e) => setCurrentLocation(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="destination">Destination</Label>
                  <Input
                    id="destination"
                    placeholder="e.g. CV1 1AA or 45 Park Road, Coventry"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </div>
              </div>
            )}

            <Button onClick={handleSearch} disabled={isLoading} className="w-full">
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Searching...</>
              ) : (
                <><Search className="h-4 w-4 mr-2" />Find Diesel Stations</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Needs refresh warning */}
        {searchTriggered && !isLoading && needsRefresh && (
          <Card className="mb-6 border-amber-500/50 bg-amber-500/5">
            <CardContent className="py-4 flex items-center gap-3">
              <Database className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  No cached station data available
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin
                    ? "Click 'Refresh Prices' above to fetch the latest data from GOV.UK."
                    : "Please ask an admin to refresh the fuel price cache."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All stations more expensive than fuel card */}
        {searchTriggered && stations.length > 0 && cardPrice && stations.every((s) => s.diesel_price > cardPrice) && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardContent className="py-4 flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                All stations are more expensive than your fuel card ({cardPrice}p). Use your fuel card!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {searchTriggered && !isLoading && isError && (
          <Card className="border-destructive/50">
            <CardContent className="py-8 text-center text-destructive">
              <Fuel className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Failed to fetch fuel prices</p>
              <p className="text-sm mt-1 text-muted-foreground">{queryError?.message || "Please try again later"}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" />Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {searchTriggered && !isLoading && !isError && stations.length === 0 && !needsRefresh && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Fuel className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No diesel stations found in this area.</p>
              {cachedAt && (
                <p className="text-xs mt-2">
                  Data last refreshed: {formatDistanceToNow(new Date(cachedAt), { addSuffix: true })}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Map */}
        {sortedStations.length > 0 && sortedStations.some(s => s.latitude && s.longitude) && (() => {
          const mappable = sortedStations.filter(s => s.latitude && s.longitude);
          const centerLat = mappable.reduce((sum, s) => sum + s.latitude!, 0) / mappable.length;
          const centerLng = mappable.reduce((sum, s) => sum + s.longitude!, 0) / mappable.length;
          return (
            <div className="mb-4 rounded-lg overflow-hidden border border-border h-[300px]">
              <MapContainer center={[centerLat, centerLng]} zoom={12} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                {mappable.map((station) => {
                  const isCheapest = station.diesel_price === cheapestPrice;
                  return (
                    <Marker
                      key={station.site_id}
                      position={[station.latitude!, station.longitude!]}
                      icon={isCheapest ? greenIcon : blueIcon}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-semibold">{station.brand}</p>
                          <p className="text-xs">{station.name}</p>
                          <p className={`font-bold mt-1 ${isCheapest ? "text-green-600" : ""}`}>
                            {station.diesel_price}p/litre
                          </p>
                          <p className="text-xs mt-0.5">{station.distance_miles} miles away</p>
                          {station.last_updated && (
                            <p className="text-xs mt-0.5">
                              Updated {formatDistanceToNow(new Date(station.last_updated), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          );
        })()}

        {stations.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stations.length} station{stations.length !== 1 ? "s" : ""} found</p>
                {cachedAt && (
                  <p className="text-xs text-muted-foreground">
                    Prices last refreshed: {formatDistanceToNow(new Date(cachedAt), { addSuffix: true })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ArrowUpDown className="h-4 w-4 mr-1" />
                      {sortBy === "price" ? "Price" : sortBy === "distance" ? "Distance" : "Updated"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSortBy("price")}>Price (cheapest)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy("distance")}>Distance (nearest)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy("updated")}>Last Updated</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4 mr-1" />Refresh
                </Button>
              </div>
            </div>

            {sortedStations.map((station, idx) => {
              const isCheapest = station.diesel_price === cheapestPrice;
              const isMostRecent = station.site_id === mostRecent?.site_id;
              const moreExpensiveThanCard = cardPrice && station.diesel_price > cardPrice;

              return (
                <Card
                  key={station.site_id}
                  className={`transition-all ${isCheapest ? "border-green-500/50 bg-green-500/5" : ""}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-foreground">{station.brand}</span>
                          {isCheapest && (
                            <Badge variant="success" className="text-xs">
                              <Trophy className="h-3 w-3 mr-1" />Cheapest
                            </Badge>
                          )}
                          {isMostRecent && (
                            <Badge className="text-xs bg-blue-500 text-white border-transparent">
                              <Clock className="h-3 w-3 mr-1" />Most Recent
                            </Badge>
                          )}
                          {moreExpensiveThanCard && (
                            <Badge variant="destructive" className="text-xs">
                              <CreditCard className="h-3 w-3 mr-1" />Use fuel card
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{station.name}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          <span>{station.address}{station.address && station.postcode ? ", " : ""}{station.postcode}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Clock className="h-3 w-3" />
                          <span>
                            Updated: {station.last_updated
                              ? formatDistanceToNow(new Date(station.last_updated), { addSuffix: true })
                              : "Unknown"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-2xl font-bold ${isCheapest ? "text-green-600" : "text-foreground"}`}>
                          {station.diesel_price}p
                        </p>
                        <p className="text-xs text-muted-foreground">per litre</p>
                        <p className="text-xs text-muted-foreground mt-1">{station.distance_miles} mi</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default FuelFinderPage;
