import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Fuel, MapPin, Clock, CreditCard, Search, Loader2, Trophy, RefreshCw, ArrowUpDown, Database, Plus, Trash2, Pencil } from "lucide-react";
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

interface FuelCard {
  id: string;
  card_name: string;
  price_per_litre: number;
  is_active: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
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
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [searchParams, setSearchParams] = useState<any>(null);
  const [sortBy, setSortBy] = useState<"price" | "distance" | "updated">("price");
  const [radiusMiles, setRadiusMiles] = useState(10);

  // New fuel card form state
  const [newCardName, setNewCardName] = useState("");
  const [newCardPrice, setNewCardPrice] = useState("");
  const [editingCard, setEditingCard] = useState<FuelCard | null>(null);
  const [editCardName, setEditCardName] = useState("");
  const [editCardPrice, setEditCardPrice] = useState("");

  // Fetch fuel cards
  const { data: fuelCards = [] } = useQuery({
    queryKey: ["fuel-cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_cards" as any)
        .select("*")
        .order("card_name", { ascending: true });
      if (error) throw error;
      return (data as any[] || []) as FuelCard[];
    },
  });

  const activeFuelCards = fuelCards.filter(c => c.is_active);
  const cheapestCardPrice = activeFuelCards.length > 0
    ? Math.min(...activeFuelCards.map(c => Number(c.price_per_litre)))
    : null;
  const cheapestCard = activeFuelCards.find(c => Number(c.price_per_litre) === cheapestCardPrice);

  // Independent cache status query
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

  // Add fuel card
  const addFuelCard = useMutation({
    mutationFn: async ({ name, price }: { name: string; price: number }) => {
      const { error } = await supabase
        .from("fuel_cards" as any)
        .insert({ card_name: name, price_per_litre: price, updated_by: userProfile?.id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuel-cards"] });
      setNewCardName("");
      setNewCardPrice("");
      toast.success("Fuel card added");
    },
    onError: () => toast.error("Failed to add fuel card"),
  });

  // Update fuel card
  const updateFuelCard = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("fuel_cards" as any)
        .update({ ...updates, updated_by: userProfile?.id } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuel-cards"] });
      setEditingCard(null);
      toast.success("Fuel card updated");
    },
    onError: () => toast.error("Failed to update fuel card"),
  });

  // Delete fuel card
  const deleteFuelCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fuel_cards" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuel-cards"] });
      toast.success("Fuel card deleted");
    },
    onError: () => toast.error("Failed to delete fuel card"),
  });

  // Toggle fuel card active status
  const toggleFuelCard = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("fuel_cards" as any)
        .update({ is_active, updated_by: userProfile?.id } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fuel-cards"] });
    },
    onError: () => toast.error("Failed to update fuel card"),
  });

  // Fetch fuel stations from cache
  const { data: stationData, isLoading, isError, error: queryError, refetch } = useQuery({
    queryKey: ["fuel-stations", searchParams, radiusMiles],
    queryFn: async () => {
      let allStations: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data: batch, error } = await supabase
          .from("fuel_station_cache")
          .select("*")
          .not("diesel_price", "is", null)
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (!batch || batch.length === 0) break;
        allStations.push(...batch);
        if (batch.length < batchSize) break;
        from += batchSize;
      }

      if (allStations.length === 0) {
        return { stations: [] as FuelStation[], count: 0, cached_at: null as string | null, needs_refresh: true };
      }

      const searchMode = searchParams?.mode || "depot";
      const searchRadius = searchMode === "depot" ? radiusMiles : 2;
      const radiusKm = searchRadius * MILES_TO_KM;

      const results: FuelStation[] = [];
      let latestCachedAt: string | null = null;

      for (const s of allStations) {
        if (!s.latitude || !s.longitude) continue;
        if (!latestCachedAt || s.cached_at > latestCachedAt) latestCachedAt = s.cached_at;

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
          diesel_price: Number(s.diesel_price) < 10 ? Number(s.diesel_price) * 100 : Number(s.diesel_price),
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
      queryClient.invalidateQueries({ queryKey: ["fuel-cache-status"] });
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

        {/* Admin Fuel Cards Management */}
        {isAdmin && (
          <Card className="mb-6 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Fuel Cards
              </CardTitle>
              <CardDescription>Manage fuel card prices (pence per litre) for comparison</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing cards list */}
              {fuelCards.length > 0 && (
                <div className="space-y-2">
                  {fuelCards.map((card) => (
                    <div key={card.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      {editingCard?.id === card.id ? (
                        <>
                          <div className="flex-1 flex gap-2">
                            <Input
                              value={editCardName}
                              onChange={(e) => setEditCardName(e.target.value)}
                              placeholder="Card name"
                              className="flex-1"
                            />
                            <Input
                              type="number"
                              step="0.1"
                              value={editCardPrice}
                              onChange={(e) => setEditCardPrice(e.target.value)}
                              placeholder="Price (ppl)"
                              className="w-28"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              const price = parseFloat(editCardPrice);
                              if (!editCardName.trim() || isNaN(price) || price <= 0) {
                                toast.error("Enter a valid name and price");
                                return;
                              }
                              updateFuelCard.mutate({ id: card.id, updates: { card_name: editCardName.trim(), price_per_litre: price } });
                            }}
                            disabled={updateFuelCard.isPending}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingCard(null)}>Cancel</Button>
                        </>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{card.card_name}</span>
                              <span className="text-sm font-bold text-primary">{Number(card.price_per_litre)}p/l</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Updated {formatDistanceToNow(new Date(card.updated_at), { addSuffix: true })}
                            </p>
                          </div>
                          <Switch
                            checked={card.is_active}
                            onCheckedChange={(checked) => toggleFuelCard.mutate({ id: card.id, is_active: checked })}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingCard(card);
                              setEditCardName(card.card_name);
                              setEditCardPrice(String(card.price_per_litre));
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              if (confirm(`Delete "${card.card_name}"?`)) {
                                deleteFuelCard.mutate(card.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add new card */}
              <div className="flex gap-2 items-end pt-2 border-t">
                <div className="flex-1">
                  <Label htmlFor="newCardName" className="text-xs">Card Name</Label>
                  <Input
                    id="newCardName"
                    placeholder="e.g. Shell Fuel Card"
                    value={newCardName}
                    onChange={(e) => setNewCardName(e.target.value)}
                  />
                </div>
                <div className="w-28">
                  <Label htmlFor="newCardPrice" className="text-xs">Price (ppl)</Label>
                  <Input
                    id="newCardPrice"
                    type="number"
                    step="0.1"
                    placeholder="139.9"
                    value={newCardPrice}
                    onChange={(e) => setNewCardPrice(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => {
                    const price = parseFloat(newCardPrice);
                    if (!newCardName.trim() || isNaN(price) || price <= 0) {
                      toast.error("Enter a valid name and price");
                      return;
                    }
                    addFuelCard.mutate({ name: newCardName.trim(), price });
                  }}
                  disabled={addFuelCard.isPending}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />Add
                </Button>
              </div>
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
                  {cacheStatusLoading ? (
                    <p className="text-xs text-muted-foreground">Checking cache…</p>
                  ) : cachedAt ? (
                    <p className="text-xs text-muted-foreground">
                      {cacheStatus?.stationCount?.toLocaleString()} stations cached · Last refreshed: {formatDistanceToNow(new Date(cachedAt), { addSuffix: true })}
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
        {!isAdmin && activeFuelCards.length > 0 && (
          <Card className="mb-6 bg-muted/50">
            <CardContent className="py-3 space-y-1">
              {activeFuelCards.map(card => (
                <div key={card.id} className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {card.card_name}: <span className="font-semibold text-foreground">{Number(card.price_per_litre)}p/litre</span>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Search Mode */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "depot" | "route")} className="mb-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="depot" id="depot" />
                <Label htmlFor="depot" className="cursor-pointer">Start from Depot</Label>
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

            {mode === "depot" && (
              <div className="mb-4">
                <Label>Search Radius</Label>
                <Select value={String(radiusMiles)} onValueChange={(v) => setRadiusMiles(Number(v))}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 miles</SelectItem>
                    <SelectItem value="5">5 miles</SelectItem>
                    <SelectItem value="10">10 miles</SelectItem>
                    <SelectItem value="15">15 miles</SelectItem>
                    <SelectItem value="25">25 miles</SelectItem>
                  </SelectContent>
                </Select>
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

        {/* All stations more expensive than cheapest fuel card */}
        {searchTriggered && stations.length > 0 && cheapestCardPrice && cheapestCard && stations.every((s) => s.diesel_price > cheapestCardPrice) && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardContent className="py-4 flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                All stations are more expensive than your {cheapestCard.card_name} ({cheapestCardPrice}p). Use your fuel card!
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
              const moreExpensiveThanCard = cheapestCardPrice && station.diesel_price > cheapestCardPrice;

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
                          {moreExpensiveThanCard && cheapestCard && (
                            <Badge variant="destructive" className="text-xs">
                              <CreditCard className="h-3 w-3 mr-1" />Use {cheapestCard.card_name}
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
