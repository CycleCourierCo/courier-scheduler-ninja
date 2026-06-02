import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, MapPin, Truck, Package, PackageMinus, ArrowRight } from "lucide-react";
import { Order } from "@/types/order";
import { StorageAllocation } from "@/pages/LoadingUnloadingPage";
import { toast } from "sonner";

interface BikeSearchSectionProps {
  orders: Order[];
  storageAllocations: StorageAllocation[];
  onAllocateStorage: (orderId: string, allocations: { bay: string; position: number; bikeIndex: number }[]) => void;
  onLoadOntoVan: (orderId: string) => void;
  onUnloadFromVan: (orderId: string) => void;
  onChangeLocation: (allocationId: string, newBay: string, newPosition: number) => void;
}

type LocationState = "pending" | "storage" | "van";

const hasBeenCollected = (order: Order) => {
  if (order.status === "collected" || order.status === "driver_to_delivery") return true;
  const updates = order.trackingEvents?.shipday?.updates || [];
  return updates.some((u: any) =>
    u.description?.toLowerCase().includes("collected") ||
    u.description?.toLowerCase().includes("pickup") ||
    u.event === "ORDER_POD_UPLOAD" ||
    u.status?.toLowerCase().includes("collected")
  );
};

const hasBeenDelivered = (order: Order) => {
  if (order.status === "delivered") return true;
  const updates = order.trackingEvents?.shipday?.updates || [];
  return updates.some((u: any) =>
    u.description?.toLowerCase().includes("delivered") ||
    u.event === "DELIVERY_POD_UPLOAD" ||
    u.status?.toLowerCase().includes("delivered")
  );
};

export const BikeSearchSection = ({
  orders,
  storageAllocations,
  onAllocateStorage,
  onLoadOntoVan,
  onUnloadFromVan,
  onChangeLocation,
}: BikeSearchSectionProps) => {
  const [query, setQuery] = useState("");
  const [allocInputs, setAllocInputs] = useState<Record<string, { bay: string; position: string }>>({});

  const candidateOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status === "cancelled") return false;
      if (hasBeenDelivered(o)) return false;
      // In play if collected, has storage, or loaded on van
      const hasStorage = storageAllocations.some((a) => a.orderId === o.id);
      return hasBeenCollected(o) || hasStorage || !!o.loaded_onto_van;
    });
  }, [orders, storageAllocations]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [] as Order[];

    return candidateOrders.filter((o) => {
      const fields: string[] = [
        o.sender?.name,
        o.receiver?.name,
        o.bikeBrand,
        o.bikeModel,
        o.trackingNumber,
        o.id,
      ].filter(Boolean) as string[];

      const bikesArr: any[] = Array.isArray((o as any).bikes) ? (o as any).bikes : [];
      bikesArr.forEach((b) => {
        if (b?.brand) fields.push(String(b.brand));
        if (b?.model) fields.push(String(b.model));
      });

      return fields.some((f) => f.toLowerCase().includes(q));
    }).slice(0, 20);
  }, [candidateOrders, query]);

  const getState = (order: Order): LocationState => {
    if (order.loaded_onto_van) return "van";
    if (storageAllocations.some((a) => a.orderId === order.id)) return "storage";
    return "pending";
  };

  const setInput = (key: string, field: "bay" | "position", value: string) => {
    setAllocInputs((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: field === "bay" ? value.toUpperCase() : value },
    }));
  };

  const handleAllocate = (order: Order) => {
    const bikeQuantity = order.bikeQuantity || 1;
    const allocatedCount = storageAllocations.filter((a) => a.orderId === order.id).length;
    const remaining = bikeQuantity - allocatedCount;
    const allocationsToMake: { bay: string; position: number; bikeIndex: number }[] = [];

    for (let i = 0; i < remaining; i++) {
      const bikeIndex = allocatedCount + i;
      const key = `${order.id}-${bikeIndex}`;
      const a = allocInputs[key];
      if (!a?.bay || !a?.position) {
        toast.error(`Enter bay and position for bike ${bikeIndex + 1}`);
        return;
      }
      const bay = a.bay.toUpperCase();
      const pos = parseInt(a.position, 10);
      if (!["A", "B", "C", "D"].includes(bay)) {
        toast.error(`Bay must be A, B, C, or D (bike ${bikeIndex + 1})`);
        return;
      }
      if (isNaN(pos) || pos < 1 || pos > 20) {
        toast.error(`Position must be 1–20 (bike ${bikeIndex + 1})`);
        return;
      }
      allocationsToMake.push({ bay, position: pos, bikeIndex });
    }
    onAllocateStorage(order.id, allocationsToMake);
    setAllocInputs((prev) => {
      const next = { ...prev };
      for (let i = 0; i < remaining; i++) delete next[`${order.id}-${allocatedCount + i}`];
      return next;
    });
  };

  const handleMove = (allocationId: string, key: string) => {
    const a = allocInputs[key];
    if (!a?.bay || !a?.position) {
      toast.error("Enter new bay and position");
      return;
    }
    const bay = a.bay.toUpperCase();
    const pos = parseInt(a.position, 10);
    if (!["A", "B", "C", "D"].includes(bay)) {
      toast.error("Bay must be A, B, C, or D");
      return;
    }
    if (isNaN(pos) || pos < 1 || pos > 20) {
      toast.error("Position must be 1–20");
      return;
    }
    onChangeLocation(allocationId, bay, pos);
    setAllocInputs((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bike-search" className="text-sm font-semibold flex items-center gap-2">
            <Search className="h-4 w-4" />
            Find a Bike
          </Label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              id="bike-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by customer name, bike, or tracking number…"
              className="pl-9 pr-9"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Find any in-progress bike to load onto a van or allocate to storage.
          </p>
        </div>

        {query.trim().length >= 2 && results.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No bikes found.
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((order) => {
              const state = getState(order);
              const orderAllocations = storageAllocations.filter((a) => a.orderId === order.id);
              const bikeQuantity = order.bikeQuantity || 1;
              const allocatedCount = orderAllocations.length;
              const remaining = bikeQuantity - allocatedCount;

              return (
                <Card key={order.id} className="p-3 border-primary/30">
                  <CardContent className="p-0 space-y-3">
                    <div className="flex gap-3">
                      {(() => {
                        const updates = order.trackingEvents?.shipday?.updates || [];
                        const pickupId = order.trackingEvents?.shipday?.pickup_id?.toString();
                        const podEvent = updates.find((u: any) =>
                          (u.event === 'ORDER_COMPLETED' || u.event === 'ORDER_POD_UPLOAD') &&
                          u.orderId === pickupId &&
                          u.podUrls && u.podUrls.length > 0
                        );
                        const photo = podEvent?.podUrls?.[0];
                        if (!photo) return null;
                        return (
                          <a href={photo} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                            <img
                              src={photo}
                              alt="Collection"
                              className="h-20 w-20 object-cover rounded border"
                              loading="lazy"
                            />
                          </a>
                        );
                      })()}
                      <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm">{order.sender?.name}</h4>
                        {state === "pending" && (
                          <Badge variant="outline" className="text-xs">
                            <Package className="h-3 w-3 mr-1" /> Pending Allocation
                          </Badge>
                        )}
                        {state === "storage" && (
                          <Badge variant="secondary" className="text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            In Storage – {orderAllocations.map((a) => `${a.bay}${a.position}`).join(", ")}
                          </Badge>
                        )}
                        {state === "van" && (
                          <Badge variant="success" className="text-xs">
                            <Truck className="h-3 w-3 mr-1" /> On Van
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {order.bikeBrand} {order.bikeModel}
                        {order.bikeQuantity && order.bikeQuantity > 1 ? ` • ${order.bikeQuantity} bikes` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        To: {order.receiver?.name} • {order.receiver?.address?.city}, {order.receiver?.address?.zipCode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tracking: <span className="font-mono">{order.trackingNumber}</span>
                      </p>
                      {order.scheduledDeliveryDate && (
                        <p className="text-xs text-muted-foreground">
                          Scheduled delivery: {new Date(order.scheduledDeliveryDate).toLocaleDateString("en-GB")}
                        </p>
                      )}
                      </div>
                    </div>

                    {state === "pending" && remaining > 0 && (
                      <div className="space-y-2 pt-2 border-t">
                        {Array.from({ length: remaining }).map((_, i) => {
                          const bikeIndex = allocatedCount + i;
                          const key = `${order.id}-${bikeIndex}`;
                          const a = allocInputs[key] || { bay: "", position: "" };
                          return (
                            <div key={key} className="flex items-end gap-2 flex-wrap">
                              {remaining > 1 && (
                                <span className="text-xs text-muted-foreground w-full">Bike {bikeIndex + 1}</span>
                              )}
                              <div className="space-y-1">
                                <Label className="text-xs">Bay</Label>
                                <Input
                                  value={a.bay}
                                  onChange={(e) => setInput(key, "bay", e.target.value)}
                                  placeholder="A–D"
                                  maxLength={1}
                                  className="w-16 h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Position</Label>
                                <Input
                                  value={a.position}
                                  onChange={(e) => setInput(key, "position", e.target.value)}
                                  placeholder="1–20"
                                  type="number"
                                  min={1}
                                  max={20}
                                  className="w-20 h-9"
                                />
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAllocate(order)}
                            className="flex-1"
                          >
                            <MapPin className="h-3 w-3 mr-1" /> Allocate to Storage
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => onLoadOntoVan(order.id)}
                            className="flex-1"
                          >
                            <Truck className="h-3 w-3 mr-1" /> Load onto Van
                          </Button>
                        </div>
                      </div>
                    )}

                    {state === "storage" && (
                      <div className="space-y-2 pt-2 border-t">
                        <Button
                          size="sm"
                          onClick={() => onLoadOntoVan(order.id)}
                          className="w-full"
                        >
                          <Truck className="h-3 w-3 mr-1" /> Load onto Van
                        </Button>
                        {orderAllocations.map((alloc) => {
                          const key = `move-${alloc.id}`;
                          const a = allocInputs[key] || { bay: "", position: "" };
                          return (
                            <div key={alloc.id} className="flex items-end gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground w-full">
                                Move {alloc.bay}{alloc.position} to:
                              </span>
                              <div className="space-y-1">
                                <Label className="text-xs">Bay</Label>
                                <Input
                                  value={a.bay}
                                  onChange={(e) => setInput(key, "bay", e.target.value)}
                                  placeholder="A–D"
                                  maxLength={1}
                                  className="w-16 h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Position</Label>
                                <Input
                                  value={a.position}
                                  onChange={(e) => setInput(key, "position", e.target.value)}
                                  placeholder="1–20"
                                  type="number"
                                  min={1}
                                  max={20}
                                  className="w-20 h-9"
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMove(alloc.id, key)}
                              >
                                <ArrowRight className="h-3 w-3 mr-1" /> Move
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {state === "van" && (
                      <div className="pt-2 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onUnloadFromVan(order.id)}
                          className="w-full border-destructive text-destructive hover:bg-destructive/10"
                        >
                          <PackageMinus className="h-3 w-3 mr-1" /> Unload from Van
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
