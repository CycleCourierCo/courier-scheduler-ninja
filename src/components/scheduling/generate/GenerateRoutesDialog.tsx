import React, { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, Loader2, MapPin, Truck, Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AtRiskLeg, PlanDay, PlanRoute, RoutePlanResult,
  fetchDifficultAreas, fetchPlanningVans, formatDuration, generateRoutes, selectPlanRoute,
} from "@/services/routeGenerationService";

const THIN_ROUTE_STOPS = 13;

const RouteCard: React.FC<{ route: PlanRoute; date: string; onUse: (route: PlanRoute) => void; busy: boolean }> = ({ route, date, onUse, busy }) => (
  <Card>
    <CardHeader className="pb-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4" /> {route.van_name}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-1">
          {route.is_expedition && <Badge variant="outline">Expedition 15h</Badge>}
          {route.stop_count < THIN_ROUTE_STOPS && <Badge variant="secondary">Thin route</Badge>}
          {route.guaranteed_count > 0 && <Badge>Guaranteed ×{route.guaranteed_count}</Badge>}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {route.stop_count} stops · {formatDuration(route.duration_s)} · {route.miles} mi · {route.max_load}/{route.van_capacity} spaces
      </p>
    </CardHeader>
    <CardContent className="space-y-3">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="px-0">View stops</Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mt-2 space-y-1 text-sm">
            {route.stops.map((stop) => (
              <li key={stop.seq} className="flex items-center justify-between gap-2 border-b py-1 last:border-0">
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">{stop.seq}.</span>
                  <span className="font-medium">{stop.label}</span>
                  <Badge variant="outline" className="text-xs">{stop.leg_type}</Badge>
                  {stop.guaranteed && <Badge className="text-xs">Guaranteed</Badge>}
                </span>
                <span className="text-muted-foreground">
                  {new Date(stop.eta).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
      <Button size="sm" onClick={() => onUse(route)} disabled={busy} className="w-full sm:w-auto">
        Use this route
      </Button>
      <p className="text-xs text-muted-foreground">Opens Get Timeslots for {format(new Date(`${date}T12:00:00`), "EEE d MMM")} with these stops in order.</p>
    </CardContent>
  </Card>
);

const AtRiskPanel: React.FC<{ atRisk: AtRiskLeg[]; infeasible: PlanDay["infeasible_guaranteed"] }> = ({ atRisk, infeasible }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center gap-2 text-base">
        <AlertTriangle className="h-4 w-4" /> At-risk jobs ({atRisk.length})
      </CardTitle>
    </CardHeader>
    <CardContent>
      {infeasible.length > 0 && (
        <div className="mb-3 space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          {infeasible.map((item) => (
            <p key={`${item.order_id}-${item.leg_type}`}>
              Guaranteed job {item.label} could not be scheduled on {format(new Date(`${item.date}T12:00:00`), "d MMM")}.
            </p>
          ))}
        </div>
      )}
      {atRisk.length === 0 ? (
        <p className="text-sm text-muted-foreground">Everything in range was planned.</p>
      ) : (
        <ScrollArea className="h-56">
          <ul className="space-y-1 pr-3 text-sm">
            {atRisk.map((leg) => (
              <li key={`${leg.order_id}-${leg.leg_type}`} className="flex items-start justify-between gap-2 border-b py-1 last:border-0">
                <span>
                  <span className="font-medium">{leg.label}</span>{" "}
                  <Badge variant="outline" className="text-xs">{leg.leg_type}</Badge>
                  <span className="block text-xs text-muted-foreground">{leg.reason}</span>
                </span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {leg.remaining_dates} date{leg.remaining_dates === 1 ? "" : "s"} left
                </span>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </CardContent>
  </Card>
);

const RoutePlanMapLazy = React.lazy(() => import("./RoutePlanMap"));

const GenerateRoutesDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [end, setEnd] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [shiftStart, setShiftStart] = useState("09:00");
  const [vans, setVans] = useState<{ id: string; name: string; capacity: number | null }[]>([]);
  const [selectedVans, setSelectedVans] = useState<string[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyRoute, setBusyRoute] = useState(false);
  const [result, setResult] = useState<RoutePlanResult | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetchPlanningVans()
      .then((rows) => {
        setVans(rows);
        setSelectedVans(rows.map((r) => r.id));
      })
      .catch(() => toast.error("Could not load the van list"));
    fetchDifficultAreas().then(setAreas).catch(() => setAreas([]));
  }, [open]);

  const activeDay = useMemo<PlanDay | null>(() => {
    if (!result) return null;
    return result.days.find((d) => d.date === activeDate) ?? result.days[0] ?? null;
  }, [result, activeDate]);

  const activeRoutes = activeDay?.variants?.[0]?.routes ?? [];

  const handleGenerate = async () => {
    if (selectedVans.length === 0) {
      toast.error("Pick at least one van");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const plan = await generateRoutes({
        horizon_start: start,
        horizon_end: end,
        shift_start: shiftStart,
        van_ids: selectedVans,
      });
      setResult(plan);
      setActiveDate(plan.days.find((d) => (d.variants?.[0]?.routes?.length ?? 0) > 0)?.date ?? plan.days[0]?.date ?? null);
      const planned = plan.days.reduce((n, d) => n + (d.variants?.[0]?.routes?.length ?? 0), 0);
      toast.success(planned > 0 ? `Planned ${planned} route${planned === 1 ? "" : "s"}` : "No routes could be built for that range");
    } catch (e) {
      toast.error((e as Error).message || "Route generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleUseRoute = async (route: PlanRoute) => {
    if (!result || !activeDay) return;
    setBusyRoute(true);
    try {
      await selectPlanRoute(result.plan_id, route.route_id);
      const jobs = route.stops
        .map((s) => `${s.order_id}:${s.leg_type === "collection" ? "pickup" : "delivery"}`)
        .join(",");
      window.open(`/job-scheduling?jobs=${jobs}&date=${activeDay.date}`, "_blank");
      toast.success("Route locked — Get Timeslots opened in a new tab");
    } catch (e) {
      toast.error((e as Error).message || "Could not use that route");
    } finally {
      setBusyRoute(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="gap-2">
          <Wand2 className="h-4 w-4" /> Generate routes
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-h-[92vh] overflow-y-auto sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle>Generate routes</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="gr-start">From</Label>
            <Input id="gr-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gr-end">To</Label>
            <Input id="gr-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gr-shift">Start time</Label>
            <Input id="gr-shift" type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={handleGenerate} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {loading ? "Working out routes…" : "Generate"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Vans available</Label>
          <div className="flex flex-wrap gap-3">
            {vans.map((van) => (
              <label key={van.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedVans.includes(van.id)}
                  onCheckedChange={(checked) =>
                    setSelectedVans((prev) => (checked ? [...prev, van.id] : prev.filter((id) => id !== van.id)))
                  }
                />
                {van.name}
                {van.capacity ? <span className="text-muted-foreground">({van.capacity})</span> : null}
              </label>
            ))}
            {vans.length === 0 && <p className="text-sm text-muted-foreground">No vans found.</p>}
          </div>
        </div>

        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {result.days.map((day) => {
                const count = day.variants?.[0]?.routes?.length ?? 0;
                const isActive = (activeDay?.date ?? "") === day.date;
                return (
                  <Button
                    key={day.date}
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                    onClick={() => setActiveDate(day.date)}
                  >
                    {format(new Date(`${day.date}T12:00:00`), "EEE d MMM")}
                    <span className="ml-2 text-xs opacity-80">{count} route{count === 1 ? "" : "s"}</span>
                  </Button>
                );
              })}
            </div>

            {activeDay && (
              <>
                <p className="text-sm text-muted-foreground">
                  Needs {activeDay.vans_needed} of {activeDay.vans_available} vans
                  {activeDay.van_names.length > 0 ? ` — ${activeDay.van_names.join(", ")}` : ""}
                </p>

                <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                  <div className="space-y-3">
                    {activeRoutes.length === 0 ? (
                      <Card>
                        <CardContent className="py-6 text-sm text-muted-foreground">
                          Nothing could be planned for this day.
                        </CardContent>
                      </Card>
                    ) : (
                      activeRoutes.map((route) => (
                        <RouteCard key={route.route_id} route={route} date={activeDay.date} onUse={handleUseRoute} busy={busyRoute} />
                      ))
                    )}
                  </div>

                  <div className="space-y-3">
                    <React.Suspense fallback={<div className="flex h-[420px] items-center justify-center rounded-md border"><MapPin className="h-5 w-5 animate-pulse" /></div>}>
                      <RoutePlanMapLazy routes={activeRoutes} areas={areas} />
                    </React.Suspense>
                    <AtRiskPanel atRisk={result.at_risk} infeasible={activeDay.infeasible_guaranteed} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GenerateRoutesDialog;
