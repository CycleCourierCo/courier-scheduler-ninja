import React, { useState, useEffect } from "react";
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
import { Fuel, MapPin, Clock, CreditCard, Search, Loader2, Trophy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { geocodeAddress } from "@/utils/geocoding";
import { format, formatDistanceToNow } from "date-fns";

interface FuelStation {
  site_id: string;
  brand: string;
  name: string;
  address: string;
  postcode: string;
  diesel_price: number;
  last_updated: string;
  distance_miles: number;
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

  // Fetch fuel stations
  const { data: stationData, isLoading, isError, error: queryError, refetch } = useQuery({
    queryKey: ["fuel-stations", searchParams],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fuel-finder", {
        body: searchParams,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { stations: FuelStation[]; count: number };
    },
    enabled: !!searchParams,
    retry: 1,
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
  const cheapestPrice = stations.length > 0 ? stations[0]?.diesel_price : null;
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

        {searchTriggered && !isLoading && !isError && stations.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Fuel className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No diesel stations found in this area.</p>
            </CardContent>
          </Card>
        )}

        {stations.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{stations.length} station{stations.length !== 1 ? "s" : ""} found</p>
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" />Refresh
              </Button>
            </div>

            {stations.map((station, idx) => {
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
