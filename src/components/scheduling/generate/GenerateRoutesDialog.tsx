import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Loader2, Lock, MapPin, RefreshCw, Truck, Unlock, Wand2 } from "lucide-react";
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
  AtRiskLeg, NeedsNewDatesLeg, PlanDay, PlanRoute, RoutePlanResult, summarisePlan, allPlanRoutes,
  clearNewDatesRequest, fetchDifficultAreas, fetchLapsedLegs, fetchPlanningVans, fetchWorkingDays, formatDuration,
  generateRoutes, isWorkingDay, lockPlanDay, nextWorkingDays, refreshAvailabilityExpiry,
  requestNewDates, selectPlanRoute, setVanUnavailable, unlockPlanDay,
} from "@/services/routeGenerationService";
import DaySummary from "./DaySummary";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { hasRole } from "@/lib/roles";
import { COST_PER_MILE, DRIVER_HOURLY_RATE, formatGBP } from "@/lib/routeCosts";
import { getRevenueForRouteStops } from "@/services/profitabilityService";

const THIN_ROUTE_STOPS = 13;
const MIN_DAYS = 2;
const MAX_DAYS = 10;

const dayLabel = (date: string) => format(new Date(`${date}T12:00:00`), "EEE d MMM");

/** Admin-only one-line cost readout for a single van's route. */
const RouteCostLine: React.FC<{ route: PlanRoute }> = ({ route }) => {
  const { userProfile } = useAuth();
  const isAdmin = hasRole(userProfile, "admin");
  const [revenue, setRevenue] = useState<number | null>(null);

  useEffect(() => {
    if (!isAdmin || route.stops.length === 0) { setRevenue(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const result = await getRevenueForRouteStops(
          route.stops.map((s) => ({
            orderId: s.order_id,
            type: s.leg_type === "collection" ? "pickup" : "delivery",
          })),
        );
        if (!cancelled) setRevenue(result.revenue);
      } catch {
        if (!cancelled) setRevenue(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, route]);

  if (!isAdmin) return null;
  const mileageCost = route.miles * COST_PER_MILE;
  const driverPay = (route.duration_s / 3600) * DRIVER_HOURLY_RATE;
  const profit = revenue === null ? null : revenue - mileageCost - driverPay;

  return (
    <p className="text-xs text-muted-foreground">
      Mileage {formatGBP(mileageCost)} · Driver {formatGBP(driverPay)} ·{" "}
      {profit === null ? (
        "Profit —"
      ) : (
        <span className={cn("font-medium", profit >= 0 ? "text-green-600" : "text-red-600")}>
          Profit {formatGBP(profit)}
        </span>
      )}
    </p>
  );
};

const RouteCard: React.FC<{ route: PlanRoute; date: string; onUse: (route: PlanRoute) => void; busy: boolean }> = ({ route, date, onUse, busy }) => (
  <Card>
    <CardHeader className="pb-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4" /> {route.van_name}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-1">
          {route.region && <Badge variant="outline">{route.region}</Badge>}
          {typeof route.spread_mi === "number" && (
            <Badge variant="secondary">{route.spread_mi} mi across</Badge>
          )}
          {route.is_expedition && <Badge variant="outline">Long day 15h</Badge>}
          {route.is_provisional && <Badge variant="secondary">Provisional</Badge>}
          {(route.thin ?? route.stop_count < THIN_ROUTE_STOPS) && (
            <Badge variant={route.below_floor ? "destructive" : "secondary"}>
              {route.thin_reason ?? "Thin route"}
            </Badge>
          )}
          {route.guaranteed_count > 0 && <Badge>Guaranteed ×{route.guaranteed_count}</Badge>}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {route.stop_count} stops · {formatDuration(route.duration_s)} · {route.miles} mi · {route.max_load}/{route.van_capacity} spaces
      </p>
      {(route.thin ?? false) && (route.urgent_labels?.length ?? 0) > 0 && (
        <p className="text-xs text-muted-foreground">
          Kept for urgent jobs: {route.urgent_labels!.join(", ")}
        </p>
      )}
      <RouteCostLine route={route} />
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
                  {stop.planned_after_expiry && <Badge variant="secondary" className="text-xs">After dates</Badge>}
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
      <p className="text-xs text-muted-foreground">Opens Get Timeslots for {dayLabel(date)} with these stops in order.</p>
    </CardContent>
  </Card>
);

/** Admin-only readout of how the plan was worked out, for before/after checks. */
const RunDetails: React.FC<{ debug?: Record<string, any> }> = ({ debug }) => {
  const { userProfile } = useAuth();
  if (!debug || !hasRole(userProfile, "admin")) return null;
  const perRoute: number[] = Array.isArray(debug.jobs_per_route) ? debug.jobs_per_route : [];
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="px-0 text-muted-foreground">Run details</Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 rounded-md border p-3 text-xs">
          <p>
            Median jobs per route {debug.median_jobs_per_route ?? 0}
            {perRoute.length > 0 ? ` (${perRoute.join(", ")})` : ""} · {debug.solve_calls ?? 0} solver calls ·{" "}
            {Math.round((debug.solve_ms ?? 0) / 1000)}s solving
          </p>
          <p>
            Vans taken off the road: {(debug.van_days_removed ?? []).length} · kept for urgent work:{" "}
            {(debug.van_days_protected ?? []).length} · stops dropped for sprawl: {debug.hard_trimmed_stops ?? 0} ·
            jobs in quiet areas: {debug.quiet_area_jobs ?? 0}
          </p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
            {JSON.stringify(debug, null, 2)}
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

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
        <ScrollArea className="h-48">
          <ul className="space-y-1 pr-3 text-sm">
            {atRisk.map((leg) => (
              <li key={`${leg.order_id}-${leg.leg_type}`} className="flex items-start justify-between gap-2 border-b py-1 last:border-0">
                <span>
                  <span className="font-medium">{leg.label}</span>{" "}
                  <Badge variant="outline" className="text-xs">{leg.leg_type}</Badge>
                  <span className="block text-xs text-muted-foreground">{leg.reason}</span>
                </span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {leg.last_date
                    ? `expires ${format(new Date(`${leg.last_date}T12:00:00`), "d MMM")}`
                    : `${leg.remaining_dates} date${leg.remaining_dates === 1 ? "" : "s"} left`}
                </span>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </CardContent>
  </Card>
);

const NeedsDatesPanel: React.FC<{ legs: NeedsNewDatesLeg[]; onChanged: () => void }> = ({ legs, onChanged }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (leg: NeedsNewDatesLeg, ask: boolean) => {
    const key = `${leg.order_id}-${leg.leg_type}`;
    setBusy(key);
    try {
      if (ask) await requestNewDates(leg.order_id, leg.leg_type);
      else await clearNewDatesRequest(leg.order_id, leg.leg_type);
      toast.success(ask ? "Marked as waiting on new dates" : "Put back into planning");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message || "Could not update that job");
    } finally {
      setBusy(null);
    }
  };

  const stateOf = (leg: NeedsNewDatesLeg) =>
    leg.date_state ?? (leg.severity === 1 ? "guaranteed_missed" : "expired");

  const groups = [
    { key: "guaranteed_missed", title: "Guaranteed date missed" },
    { key: "expired", title: "Dates expired" },
    { key: "never_provided", title: "Waiting on first dates from the customer" },
  ].map((g) => ({ ...g, items: legs.filter((l) => stateOf(l) === g.key) }))
    .filter((g) => g.items.length > 0);

  const expiredCount = legs.filter((l) => stateOf(l) !== "never_provided").length;

  const renderLeg = (leg: NeedsNewDatesLeg) => {
    const key = `${leg.order_id}-${leg.leg_type}`;
    const neverDated = stateOf(leg) === "never_provided";
    return (
      <li key={key} className={`rounded-md border p-2 ${leg.severity === 1 ? "border-destructive/50 bg-destructive/10" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{leg.label}</span>
          <Badge variant="outline" className="text-xs">{leg.leg_type}</Badge>
          {leg.status === "awaiting_new_dates" && <Badge variant="secondary" className="text-xs">Asked</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{leg.reason}</p>
        {leg.days_in_depot !== null && leg.days_in_depot !== undefined && (
          <p className="text-xs text-muted-foreground">{leg.days_in_depot} days in the depot</p>
        )}
        {leg.linked_leg_note && <p className="text-xs text-muted-foreground">{leg.linked_leg_note}</p>}
        <div className="mt-2 flex gap-2">
          {leg.status === "awaiting_new_dates" ? (
            <Button size="sm" variant="outline" disabled={busy === key} onClick={() => act(leg, false)}>
              Dates sorted
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={busy === key} onClick={() => act(leg, true)}>
              {neverDated ? "Ask for dates" : "Ask for new dates"}
            </Button>
          )}
        </div>
      </li>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4" /> Needs dates ({legs.length})
          {legs.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {expiredCount} expired
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {legs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every job has a usable date.</p>
        ) : (
          <ScrollArea className="h-56">
            <div className="space-y-3 pr-3 text-sm">
              {groups.map((g) => (
                <div key={g.key} className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {g.title} ({g.items.length})
                  </p>
                  <ul className="space-y-2">{g.items.map(renderLeg)}</ul>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

const RoutePlanMapLazy = React.lazy(() => import("./RoutePlanMap"));

const GenerateRoutesDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [workingDays, setWorkingDays] = useState<string[]>(["sun", "mon", "tue", "wed", "thu"]);
  const [dates, setDates] = useState<string[]>([]);
  const [extraDate, setExtraDate] = useState("");
  const [shiftStart, setShiftStart] = useState("09:00");
  const [firmDays, setFirmDays] = useState(2);
  const [inspectionLead, setInspectionLead] = useState<string>("");
  const [vans, setVans] = useState<{ id: string; name: string; capacity: number | null }[]>([]);
  const [grid, setGrid] = useState<Record<string, string[]>>({});
  const [areas, setAreas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyRoute, setBusyRoute] = useState(false);
  const [result, setResult] = useState<RoutePlanResult | null>(null);
  const [includeExpired, setIncludeExpired] = useState(false);
  /** Whether a 15h long day may be used for one difficult area. */
  const [maxLongDays, setMaxLongDays] = useState(1);
  /** Jobs a proper day's route should carry — vans come off the road to reach it. */
  const [minJobsTarget, setMinJobsTarget] = useState(13);
  /** Fewest jobs a route may carry before it is flagged for a dispatcher. */
  const [minJobsFloor, setMinJobsFloor] = useState(9);
  const [lapsedLegs, setLapsedLegs] = useState<NeedsNewDatesLeg[]>([]);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [lockedDays, setLockedDays] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [vanRows, days] = await Promise.all([
        fetchPlanningVans().catch(() => []),
        fetchWorkingDays().catch(() => ["sun", "mon", "tue", "wed", "thu"]),
      ]);
      setVans(vanRows);
      setWorkingDays(days);
      const defaults = nextWorkingDays(days, 5);
      setDates(defaults);
      setGrid(Object.fromEntries(defaults.map((d) => [d, vanRows.map((v) => v.id)])));
      fetchDifficultAreas().then(setAreas).catch(() => setAreas([]));
      fetchLapsedLegs().then(setLapsedLegs).catch(() => setLapsedLegs([]));
    })();
  }, [open]);

  const toggleDate = (date: string) => {
    setDates((prev) => {
      const next = prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort();
      setGrid((g) => {
        const copy = { ...g };
        if (!copy[date]) copy[date] = vans.map((v) => v.id);
        return copy;
      });
      return next.slice(0, MAX_DAYS);
    });
  };

  const toggleVanDay = async (date: string, vanId: string) => {
    const current = grid[date] ?? vans.map((v) => v.id);
    const nowAvailable = !current.includes(vanId);
    setGrid({ ...grid, [date]: nowAvailable ? [...current, vanId] : current.filter((id) => id !== vanId) });
    try {
      await setVanUnavailable(vanId, date, !nowAvailable);
    } catch {
      // grid still applies to this run even if the note could not be saved
    }
  };

  /** Tick or untick every van on one day. */
  const setDayVans = async (date: string, on: boolean) => {
    const all = vans.map((v) => v.id);
    setGrid((g) => ({ ...g, [date]: on ? all : [] }));
    await Promise.all(all.map((id) => setVanUnavailable(id, date, !on).catch(() => null)));
  };

  /** Tick or untick one van across every day being planned. */
  const setVanAllDays = async (vanId: string, on: boolean) => {
    setGrid((g) => {
      const copy = { ...g };
      for (const d of dates) {
        const current = copy[d] ?? vans.map((v) => v.id);
        copy[d] = on
          ? [...new Set([...current, vanId])]
          : current.filter((id) => id !== vanId);
      }
      return copy;
    });
    await Promise.all(dates.map((d) => setVanUnavailable(vanId, d, !on).catch(() => null)));
  };

  const candidateDates = useMemo(() => {
    const base = nextWorkingDays(workingDays, 10);
    return [...new Set([...base, ...dates])].sort();
  }, [workingDays, dates]);

  const activeDay = useMemo<PlanDay | null>(() => {
    if (!result) return null;
    return result.days.find((d) => d.date === activeDate) ?? result.days[0] ?? null;
  }, [result, activeDate]);

  const activeRoutes = activeDay?.variants?.[0]?.routes ?? [];

  /** Run results take priority; DB rows fill the panel before the first run. */
  const needsDates = useMemo(() => {
    const runLegs = result?.needs_new_dates ?? [];
    const seen = new Set(runLegs.map((l) => `${l.order_id}:${l.leg_type}`));
    return [...runLegs, ...lapsedLegs.filter((l) => !seen.has(`${l.order_id}:${l.leg_type}`))];
  }, [result, lapsedLegs]);

  const planInput = (gridOverride?: Record<string, string[]>) => ({
    selected_dates: dates,
    shift_start: shiftStart,
    van_availability: Object.fromEntries(
      dates.map((d) => [d, (gridOverride ?? grid)[d] ?? vans.map((v) => v.id)]),
    ),
    firm_days: firmDays,
    inspection_lead_days: inspectionLead === "" ? null : Number(inspectionLead),
    include_expired: includeExpired,
    max_long_days: maxLongDays,
    min_jobs_target: minJobsTarget,
    min_jobs_floor: minJobsFloor,
  });

  const runPlan = async (gridOverride?: Record<string, string[]>) => {
    setLoading(true);
    setLockedDays([]);
    try {
      const plan = await generateRoutes(planInput(gridOverride));
      setResult(plan);
      setActiveDate(
        plan.days.find((d) => (d.variants?.[0]?.routes?.length ?? 0) > 0)?.date ?? plan.days[0]?.date ?? null,
      );
      const planned = plan.days.reduce((n, d) => n + (d.variants?.[0]?.routes?.length ?? 0), 0);
      toast.success(
        planned > 0
          ? `Planned ${planned} route${planned === 1 ? "" : "s"} across ${dates.length} day${dates.length === 1 ? "" : "s"}`
          : "No routes could be built for those days",
      );
    } catch (e) {
      toast.error((e as Error).message || "Route generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (dates.length < MIN_DAYS) {
      toast.error(`Pick at least ${MIN_DAYS} days to plan`);
      return;
    }
    if (dates.every((d) => (grid[d] ?? []).length === 0)) {
      toast.error("No vans are ticked on any of those days");
      return;
    }
    setResult(null);
    await runPlan();
  };

  /** Try the same days again with one van more, or one fewer, on a single day. */
  const handleAdjustVans = async (date: string, delta: 1 | -1) => {
    const current = grid[date] ?? vans.map((v) => v.id);
    let next: string[];
    if (delta === -1) {
      if (current.length <= 1) { toast.error("That day is already down to one van"); return; }
      next = current.slice(0, current.length - 1);
    } else {
      const spare = vans.find((v) => !current.includes(v.id));
      if (!spare) { toast.error("Every van is already on that day"); return; }
      next = [...current, spare.id];
    }
    const nextGrid = { ...grid, [date]: next };
    setGrid(nextGrid);
    await runPlan(nextGrid);
  };

  const handleRefreshExpiry = async () => {
    try {
      const res = await refreshAvailabilityExpiry();
      toast.success(`Checked dates — ${res.expired} expired, ${res.revived} back in play`);
    } catch (e) {
      toast.error((e as Error).message || "Could not check dates");
    }
  };

  const handleLockDay = async (date: string, lock: boolean) => {
    if (!result?.plan_id) return;
    setBusyRoute(true);
    try {
      if (lock) await lockPlanDay(result.plan_id, date);
      else await unlockPlanDay(result.plan_id, date);
      setLockedDays((prev) => (lock ? [...prev, date] : prev.filter((d) => d !== date)));
      toast.success(lock ? `${dayLabel(date)} locked — its jobs are reserved` : `${dayLabel(date)} released`);
    } catch (e) {
      toast.error((e as Error).message || "Could not change that day");
    } finally {
      setBusyRoute(false);
    }
  };

  const handleUseRoute = async (route: PlanRoute) => {
    if (!result?.plan_id || !activeDay) return;
    setBusyRoute(true);
    try {
      await selectPlanRoute(result.plan_id, route.route_id);
      setCommittedMode(mode);
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

        <div className="space-y-2">
          <Label>Days to plan ({dates.length})</Label>
          <div className="flex flex-wrap gap-2">
            {candidateDates.map((date) => (
              <Button
                key={date}
                type="button"
                size="sm"
                variant={dates.includes(date) ? "default" : "outline"}
                onClick={() => toggleDate(date)}
              >
                {dayLabel(date)}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="gr-extra" className="text-xs">Add another day</Label>
              <Input id="gr-extra" type="date" value={extraDate} onChange={(e) => setExtraDate(e.target.value)} className="w-[170px]" />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (!extraDate) return;
                if (!isWorkingDay(extraDate, workingDays)) {
                  toast.error("That day isn't a working day");
                  return;
                }
                toggleDate(extraDate);
                setExtraDate("");
              }}
            >
              Add day
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-7">
          <div className="space-y-1">
            <Label htmlFor="gr-shift">Start time</Label>
            <Input id="gr-shift" type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gr-firm">Firm days</Label>
            <Input id="gr-firm" type="number" min={0} max={dates.length} value={firmDays}
              onChange={(e) => setFirmDays(Math.max(0, Number(e.target.value) || 0))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gr-lead">Inspection lead days</Label>
            <Input id="gr-lead" type="number" min={0} max={14} placeholder="never" value={inspectionLead}
              onChange={(e) => setInspectionLead(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gr-long">Max long days per day</Label>
            <Input id="gr-long" type="number" min={0} max={4} value={maxLongDays}
              onChange={(e) => setMaxLongDays(Math.max(0, Math.min(4, Number(e.target.value) || 0)))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gr-target">Jobs per route (target)</Label>
            <Input id="gr-target" type="number" min={1} max={30} value={minJobsTarget}
              onChange={(e) => setMinJobsTarget(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gr-floor">Fewest jobs allowed</Label>
            <Input id="gr-floor" type="number" min={1} max={minJobsTarget} value={minJobsFloor}
              onChange={(e) => setMinJobsFloor(Math.max(1, Math.min(minJobsTarget, Number(e.target.value) || 1)))} />
          </div>
          <div className="flex items-end">
            <Button onClick={handleGenerate} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {loading ? "Working out routes…" : "Generate"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Van availability</Label>
            <div className="flex flex-wrap items-center gap-2">
              {needsDates.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant={includeExpired ? "default" : "outline"}
                  className="gap-2"
                  onClick={() => setIncludeExpired((v) => !v)}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  {includeExpired
                    ? `Including ${needsDates.length} expired job${needsDates.length === 1 ? "" : "s"}`
                    : `Include expired jobs (${needsDates.length})`}
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={handleRefreshExpiry}>
                <RefreshCw className="h-3.5 w-3.5" /> Re-check customer dates
              </Button>
            </div>
          </div>
          {vans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vans found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                     <th className="p-2 text-left font-medium">Van</th>
                    {dates.map((d) => {
                      const dayVans = grid[d] ?? vans.map((v) => v.id);
                      const allOn = vans.every((v) => dayVans.includes(v.id));
                      return (
                        <th key={d} className="p-2 text-center font-medium">
                          <div className="flex flex-col items-center gap-1">
                            <span>{format(new Date(`${d}T12:00:00`), "EEE d")}</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs font-normal text-muted-foreground"
                              onClick={() => setDayVans(d, !allOn)}
                            >
                              {allOn ? "None" : "All"}
                            </Button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {vans.map((van) => {
                    const onEveryDay = dates.every((d) => (grid[d] ?? vans.map((v) => v.id)).includes(van.id));
                    return (
                    <tr key={van.id} className="border-t">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <span>
                            {van.name}
                            {van.capacity ? <span className="text-muted-foreground"> ({van.capacity})</span> : null}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs font-normal text-muted-foreground"
                            onClick={() => setVanAllDays(van.id, !onEveryDay)}
                          >
                            {onEveryDay ? "No days" : "All days"}
                          </Button>
                        </div>
                      </td>
                      {dates.map((d) => (
                        <td key={d} className="p-2 text-center">
                          <Checkbox
                            checked={(grid[d] ?? vans.map((v) => v.id)).includes(van.id)}
                            onCheckedChange={() => toggleVanDay(d, van.id)}
                          />
                        </td>
                      ))}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {result && (
          <div className="space-y-4">
            {result.distance_costing === false && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
                Mileage was not taken into account on this plan — routes may wander. Try again.
              </div>
            )}
            {(result.skipped?.length ?? 0) > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-700 dark:text-amber-400">
                Plan incomplete — skipped: {result.skipped!.join("; ")}. Generate again to finish.
              </div>
            )}
            <RunDetails debug={result.debug} />
            <div className="flex flex-wrap items-center gap-2">
              {(["joint", "greedy"] as PlanMode[]).map((m) => {
                const summary = summarisePlan(plans[m]);
                return (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={mode === m ? "default" : "outline"}
                    className="h-auto flex-col items-start gap-0.5 py-2 text-left"
                    disabled={!plans[m]}
                    onClick={() => { setMode(m); setLockedDays([]); }}
                  >
                    <span>{m === "joint" ? "Balanced across the days" : "Day by day"}</span>
                    <span className="text-xs font-normal opacity-80">
                      {plans[m]
                        ? `${summary.stops} stops · ${summary.vanDays} van-days · ${Math.round(summary.hours)}h · ${Math.round(summary.miles)} mi · ${summary.leftOver} left over`
                        : retrying === m
                        ? "building…"
                        : "not available"}
                    </span>
                    {committedMode && committedMode !== m && plans[m] && (
                      <span className="text-xs font-normal text-amber-600">out of date — jobs reserved on the other plan</span>
                    )}
                  </Button>
                );
              })}
              {(["joint", "greedy"] as PlanMode[]).map((m) =>
                planErrors[m] ? (
                  <div key={`${m}-err`} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{m === "greedy" ? "Day by day" : "Balanced"} could not be built: {planErrors[m]}</span>
                    <Button type="button" size="sm" variant="outline" disabled={retrying === m} onClick={() => handleRetryMode(m)}>
                      {retrying === m ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Try again"}
                    </Button>
                  </div>
                ) : null,
              )}
            </div>

            <DaySummary
              date={`plan:${mode}:${result.plan_id ?? ""}`}
              routes={allPlanRoutes(result)}
              title={mode === "greedy" ? "Whole plan — day by day" : "Whole plan — balanced"}
              costTitle="Costings for the whole plan"
              vansAvailable={result.days.reduce((n, d) => n + (d.vans_available ?? 0), 0)}
              leftOver={summarisePlan(result).leftOver}
              leftOverLapsed={result.unplanned_lapsed_count}
              expiringCount={result.expiring_in_plan_count}
              expiringUnplanned={result.expiring_unplanned_count}
            />
            {result.weekly && (
              <p className="text-sm text-muted-foreground">
                {result.weekly.van_days_needed} of {result.weekly.van_days_available} van-days used
                {result.weekly.short_days.length > 0
                  ? ` — short on ${result.weekly.short_days.map(dayLabel).join(", ")}`
                  : " — the fleet covers this plan"}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {result.days.map((day) => {
                const count = day.variants?.[0]?.routes?.length ?? 0;
                const isActive = (activeDay?.date ?? "") === day.date;
                return (
                  <Button key={day.date} size="sm" variant={isActive ? "default" : "outline"} onClick={() => setActiveDate(day.date)}>
                    {dayLabel(day.date)}
                    <span className="ml-2 text-xs opacity-80">{count} route{count === 1 ? "" : "s"}</span>
                    {lockedDays.includes(day.date) && <Lock className="ml-1 h-3 w-3" />}
                  </Button>
                );
              })}
            </div>

            {activeDay && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Needs {activeDay.vans_needed} of {activeDay.vans_available} vans
                    {activeDay.van_names.length > 0 ? ` — ${activeDay.van_names.join(", ")}` : ""}
                    {activeDay.is_provisional ? " · provisional" : ""}
                    {activeDay.shortfall
                      ? ` · ${activeDay.shortfall.extra_vans} more van${activeDay.shortfall.extra_vans === 1 ? "" : "s"} would fit ${activeDay.shortfall.extra_jobs} more jobs`
                      : ""}
                  </p>
                  {activeDay.vans_needed > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      disabled={busyRoute}
                      onClick={() => handleLockDay(activeDay.date, !lockedDays.includes(activeDay.date))}
                    >
                      {lockedDays.includes(activeDay.date) ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      {lockedDays.includes(activeDay.date) ? "Release day" : "Lock day"}
                    </Button>
                  )}
                </div>

                <DaySummary
                  date={activeDay.date}
                  routes={activeRoutes}
                  vansAvailable={activeDay.vans_available}
                  leftOver={activeDay.unplanned_count}
                  leftOverLapsed={activeDay.unplanned_lapsed_count}
                  lapsedPlanned={activeDay.lapsed_count}
                  expiringCount={activeDay.expiring_count}
                  expiringUnplanned={activeDay.expiring_unplanned_count}
                />

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
                    <NeedsDatesPanel legs={needsDates} onChanged={handleRefreshExpiry} />
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
