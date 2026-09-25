import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useActiveUsers } from "@/hooks/useActiveUsers";
import { cn } from "@/lib/utils";
import {
  ABSENCE_LABELS, AbsenceRequest, addDays, eachDay, fmtDay, getBankHolidaySet, getMinDrivers,
  getOverrides, getRotaAbsences, getWeeklyAvailability, londonToday, resolveDay, weekStartSunday,
} from "@/services/driverRotaService";

const DAY_START = 6, DAY_END = 20; // timeline scale, hours
const toHours = (t: string | null, fallback: number) => {
  if (!t) return fallback; const [h, m] = t.split(":").map(Number); return h + (m || 0) / 60;
};
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

type Cell = {
  kind: "work" | "off" | "bank" | "approved" | "pending";
  start: string | null; end: string | null; absence?: AbsenceRequest; note?: string | null;
};

const DriversRota = () => {
  const today = londonToday();
  const [weekStart, setWeekStart] = useState(weekStartSunday(today));
  const [depot, setDepot] = useState("all");
  const days = useMemo(() => eachDay(weekStart, addDays(weekStart, 6)), [weekStart]);
  const weekEnd = days[6];

  const { data: drivers = [] } = useActiveUsers("driver");
  const ids = drivers.map((d) => d.id);
  const { data, isLoading } = useQuery({
    queryKey: ["rota", weekStart, ids.join()],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [weekly, overrides, absences, bank, min] = await Promise.all([
        getWeeklyAvailability(ids), getOverrides(weekStart, weekEnd, ids),
        getRotaAbsences(weekStart, weekEnd), getBankHolidaySet(), getMinDrivers(),
      ]);
      return { weekly, overrides, absences, bank, min };
    },
  });
  const { data: sites = [] } = useQuery({
    queryKey: ["rota-sites"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("sites").select("id, name").order("name");
      return (data || []) as { id: string; name: string }[];
    },
  });

  const shown = drivers.filter((d) => depot === "all" || (depot === "none" ? !d.depot_id : d.depot_id === depot));

  const cellFor = (driverId: string, date: string): Cell => {
    if (!data) return { kind: "off", start: null, end: null };
    const abs = data.absences.find((a) => a.driver_id === driverId && a.start_date <= date && a.end_date >= date);
    const day = resolveDay(driverId, date, data.weekly, data.overrides);
    if (abs) return { kind: abs.status === "approved" ? "approved" : "pending", start: day.start, end: day.end, absence: abs };
    if (data.bank.has(date) && !day.override) return { kind: "bank", start: null, end: null };
    return { kind: day.works ? "work" : "off", start: day.start, end: day.end, note: day.override?.note };
  };

  const availableCount = (date: string) => shown.filter((d) => {
    const c = cellFor(d.id, date); return c.kind === "work" || c.kind === "pending";
  }).length;

  const legend = [
    ["bg-primary", "Working"], ["bg-destructive", "Approved absence"],
    ["bg-accent", "Pending absence"], ["bg-muted", "Not working / bank holiday"],
  ];

  const renderCell = (driverId: string, date: string) => {
    const c = cellFor(driverId, date);
    const s = toHours(c.start, DAY_START), e = toHours(c.end, DAY_END);
    const left = ((Math.max(s, DAY_START) - DAY_START) / (DAY_END - DAY_START)) * 100;
    const width = Math.max(4, ((Math.min(e, DAY_END) - Math.max(s, DAY_START)) / (DAY_END - DAY_START)) * 100);
    const label = c.kind === "work" ? (c.start ? `${hhmm(c.start)}–${hhmm(c.end)}` : "All day")
      : c.kind === "bank" ? "Bank hol" : c.kind === "off" ? "Off"
      : `${ABSENCE_LABELS[c.absence!.type]}${c.kind === "pending" ? " (pending)" : ""}`;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="w-full text-left" aria-label={`${fmtDay(date)}: ${label}`}>
            <div className="relative h-6 overflow-hidden rounded bg-muted">
              {c.kind === "work" && <div className="absolute inset-y-0 rounded bg-primary" style={{ left: `${left}%`, width: `${width}%` }} />}
              {c.kind === "approved" && <div className="absolute inset-0 bg-destructive" />}
              {c.kind === "pending" && <div className="absolute inset-0 bg-accent" />}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{label}</p>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 text-sm">
          <p className="font-semibold">{fmtDay(date, { weekday: "long", day: "numeric", month: "long" })}</p>
          <p className="mt-1">{label}</p>
          {c.absence && <p className="text-muted-foreground">{fmtDay(c.absence.start_date)} – {fmtDay(c.absence.end_date)} · {c.absence.status}</p>}
          {c.note && <p className="text-muted-foreground">Override: {c.note}</p>}
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <Layout>
      <div className="container mx-auto space-y-4 px-4 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Drivers rota</h1>
            <p className="text-muted-foreground">Who can work each day, Sunday to Saturday.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={depot} onValueChange={setDepot}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Depot" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All depots</SelectItem>
                <SelectItem value="none">No depot set</SelectItem>
                {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={() => setWeekStart(weekStartSunday(today))}>This week</Button>
            <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {legend.map(([c, l]) => <span key={l} className="flex items-center gap-1"><span className={cn("h-3 w-3 rounded", c)} />{l}</span>)}
          <span>Bars show {DAY_START}:00–{DAY_END}:00.</span>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading rota…</p>}

        {/* Desktop grid */}
        <Card className="hidden md:block">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="w-44 p-2 text-left">Driver</th>
                  {days.map((d) => {
                    const n = availableCount(d); const low = data && n < data.min;
                    return (
                      <th key={d} className={cn("p-2 text-left font-medium", d === today && "bg-muted/50")}>
                        <div>{fmtDay(d)}</div>
                        <div className={cn("flex items-center gap-1 text-xs font-normal", low ? "text-destructive" : "text-muted-foreground")}>
                          {low && <AlertTriangle className="h-3 w-3" />}{n} available
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {shown.map((drv) => (
                  <tr key={drv.id} className="border-b last:border-0">
                    <td className="p-2 font-medium">{drv.name || drv.email}</td>
                    {days.map((d) => <td key={d} className={cn("p-2 align-top", d === today && "bg-muted/50")}>{renderCell(drv.id, d)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Mobile: stacked days */}
        <div className="space-y-3 md:hidden">
          {days.map((d) => {
            const n = availableCount(d); const low = data && n < data.min;
            return (
              <Card key={d}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{fmtDay(d, { weekday: "long", day: "numeric", month: "short" })}</p>
                    <Badge variant={low ? "destructive" : "secondary"}>{n} available</Badge>
                  </div>
                  {shown.map((drv) => (
                    <div key={drv.id} className="grid grid-cols-[7rem_1fr] items-start gap-2">
                      <span className="truncate text-sm">{drv.name || drv.email}</span>
                      {renderCell(drv.id, d)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
        {!shown.length && !isLoading && <p className="text-sm text-muted-foreground">No active drivers.</p>}
      </div>
    </Layout>
  );
};

export default DriversRota;
