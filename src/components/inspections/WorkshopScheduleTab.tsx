import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Wrench, Search, PackageOpen, Sparkles, ClipboardCheck, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWorkshopSettings } from "@/lib/labourPricing";
import { fetchHolidayDates } from "@/services/holidayService";
import {
  fetchWorkshopSchedule,
  packSchedule,
  type WorkshopJob,
} from "@/services/workshopScheduleService";
import { toast } from "sonner";

const kindMeta: Record<WorkshopJob["kind"], { label: string; icon: JSX.Element; className: string }> = {
  inspect: {
    label: "Inspect",
    icon: <Search className="h-3 w-3" />,
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  repair: {
    label: "Repair",
    icon: <Wrench className="h-3 w-3" />,
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  cleaning: {
    label: "Clean",
    icon: <Sparkles className="h-3 w-3" />,
    className: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
  },
};

const ageBadge = (days: number) => {
  if (days >= 14) return "bg-destructive text-destructive-foreground";
  if (days >= 7) return "bg-amber-500 text-white";
  return "bg-muted text-muted-foreground";
};

const JobCard = ({ job }: { job: WorkshopJob }) => {
  const meta = kindMeta[job.kind];
  return (
    <Link
      to={`/orders/${job.orderId}`}
      className="block rounded-md border bg-card hover:bg-accent/40 transition-colors p-2.5"
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{job.bikeLabel}</div>
          {job.trackingNumber && (
            <div className="text-xs text-muted-foreground truncate">{job.trackingNumber}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant="outline" className={`text-xs gap-1 ${meta.className}`}>
            {meta.icon}
            {meta.label}
          </Badge>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${ageBadge(job.ageDays)}`}>
            {job.ageDays}d old
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-1.5 text-xs">
        <span className="text-muted-foreground">{job.minutes} min</span>
        <div className="flex gap-1">
          {job.cleaningPending && (
            <span className="text-purple-600 dark:text-purple-300 text-[10px]">+clean</span>
          )}
          {job.awaitingPart && (
            <span className="text-amber-600 dark:text-amber-300 text-[10px] truncate max-w-[100px]">
              {job.awaitingPart}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

interface Props {
  canManage: boolean;
}

export default function WorkshopScheduleTab({ canManage }: Props) {
  const { data: settings } = useWorkshopSettings();
  const hourlyRate = settings?.hourly_rate_gbp ?? 75;

  const [capacity, setCapacity] = useState<number>(480);
  const [capacityLoaded, setCapacityLoaded] = useState(false);
  const [savingCapacity, setSavingCapacity] = useState(false);

  // Load daily_capacity_minutes (not part of useWorkshopSettings hook yet)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("workshop_settings")
        .select("daily_capacity_minutes" as any)
        .eq("id", 1)
        .maybeSingle();
      if (cancelled) return;
      const val = (data as any)?.daily_capacity_minutes;
      if (typeof val === "number" && val > 0) setCapacity(val);
      setCapacityLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveCapacity = async () => {
    setSavingCapacity(true);
    try {
      const { error } = await supabase
        .from("workshop_settings")
        .update({ daily_capacity_minutes: capacity } as any)
        .eq("id", 1);
      if (error) throw error;
      toast.success("Daily capacity saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save capacity");
    } finally {
      setSavingCapacity(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["workshop-schedule", hourlyRate],
    queryFn: () => fetchWorkshopSchedule(hourlyRate),
    staleTime: 30 * 1000,
  });

  const { data: holidayDates } = useQuery({
    queryKey: ["holiday-dates"],
    queryFn: fetchHolidayDates,
    staleTime: 5 * 60 * 1000,
  });

  const scheduledJobs = useMemo(() => {
    if (!data) return [];
    // ready first, then needsInspection — both oldest-first already
    return [...data.ready, ...data.needsInspection];
  }, [data]);

  const plan = useMemo(
    () => packSchedule(scheduledJobs, capacity, holidayDates || []),
    [scheduledJobs, capacity, holidayDates],
  );

  if (isLoading || !capacityLoaded) {
    return <p className="text-muted-foreground text-center py-8">Loading schedule…</p>;
  }

  const readyCount = data?.ready.length ?? 0;
  const inspectCount = data?.needsInspection.length ?? 0;
  const partsCount = data?.awaitingParts.length ?? 0;

  const totalBacklogMinutes =
    (data?.ready.reduce((s, j) => s + j.minutes, 0) ?? 0) +
    (data?.needsInspection.reduce((s, j) => s + j.minutes, 0) ?? 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <Label htmlFor="daily-cap" className="text-xs text-muted-foreground">
              Daily workshop capacity (minutes)
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="daily-cap"
                type="number"
                min={30}
                step={30}
                value={capacity}
                disabled={!canManage}
                onChange={(e) => setCapacity(Math.max(30, Number(e.target.value) || 0))}
                className="w-32"
              />
              {canManage && (
                <Button size="sm" onClick={saveCapacity} disabled={savingCapacity}>
                  Save
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                = {Math.round((capacity / 60) * 10) / 10}h/day
              </span>
            </div>
          </div>
          <div className="text-sm text-muted-foreground grid grid-cols-2 sm:flex sm:gap-6 gap-2">
            <div>
              <div className="text-xs">Backlog</div>
              <div className="font-semibold text-foreground">
                {readyCount + inspectCount} bikes · {Math.round(totalBacklogMinutes / 60)}h
              </div>
            </div>
            <div>
              <div className="text-xs">Awaiting parts</div>
              <div className="font-semibold text-foreground">{partsCount} bikes</div>
            </div>
            <div>
              <div className="text-xs">Est. days to clear</div>
              <div className="font-semibold text-foreground">
                {capacity > 0 ? Math.ceil(totalBacklogMinutes / capacity) : "—"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Backlog */}
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Backlog
            </CardTitle>
            <CardDescription className="text-xs">Oldest first</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                <Wrench className="h-3 w-3" /> Ready to work ({readyCount})
              </h4>
              {readyCount === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nothing ready right now.</p>
              ) : (
                <div className="space-y-2">
                  {data!.ready.map((j) => (
                    <JobCard key={`r-${j.orderId}`} job={j} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                <Search className="h-3 w-3" /> Needs inspection ({inspectCount})
              </h4>
              {inspectCount === 0 ? (
                <p className="text-xs text-muted-foreground py-2">All caught up.</p>
              ) : (
                <div className="space-y-2">
                  {data!.needsInspection.map((j) => (
                    <JobCard key={`n-${j.orderId}`} job={j} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                <PackageOpen className="h-3 w-3" /> Awaiting parts ({partsCount})
              </h4>
              {partsCount === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No blocked repairs.</p>
              ) : (
                <div className="space-y-2">
                  {data!.awaitingParts.map((j) => (
                    <JobCard key={`p-${j.orderId}`} job={j} />
                  ))}
                </div>
              )}
            </section>
          </CardContent>
        </Card>

        {/* Projected plan */}
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Projected plan
            </CardTitle>
            <CardDescription className="text-xs">
              Capacity {capacity} min/day · weekends & holidays skipped
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {plan.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nothing scheduled.</p>
            ) : (
              plan.map((day) => {
                const pct = Math.min(100, Math.round((day.usedMinutes / capacity) * 100));
                return (
                  <div key={day.date.toISOString()} className="rounded-md border bg-card p-2.5">
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="font-medium text-sm">
                        {format(day.date, "EEE d MMM")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {day.usedMinutes}/{capacity} min
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded overflow-hidden mb-2">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      {day.jobs.map((j) => (
                        <JobCard key={`${day.date.toISOString()}-${j.orderId}`} job={j} />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
