import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, startOfWeek } from "date-fns";
import { Clock, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { timeslipService } from "@/services/timeslipService";

type DriverTotals = {
  driverId: string;
  name: string;
  totalHours: number;
  drivingHours: number;
  stopHours: number;
  mileage: number;
  days: number;
  stops: number;
  missingMileageDays: number;
};

// Default range: Sunday -> Thursday of the current week.
// On Friday/Saturday this is the working week that has just finished.
const getDefaultRange = (): { from: string; to: string } => {
  const sunday = startOfWeek(new Date(), { weekStartsOn: 0 });
  return {
    from: format(sunday, "yyyy-MM-dd"),
    to: format(addDays(sunday, 4), "yyyy-MM-dd"),
  };
};

const fmtHours = (h: number) => `${h.toFixed(2)}h`;
const fmtMiles = (m: number) => `${Math.round(m).toLocaleString()} mi`;

const DriverHoursMileagePanel: React.FC = () => {
  const defaults = useMemo(getDefaultRange, []);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  const { data: timeslips, isLoading } = useQuery({
    queryKey: ["driver-hours-mileage", dateFrom, dateTo],
    queryFn: () => timeslipService.getAllTimeslips({ dateFrom, dateTo }),
  });

  const rows = useMemo<DriverTotals[]>(() => {
    const map = new Map<string, DriverTotals>();
    (timeslips || []).forEach((t) => {
      const key = t.driver_id;
      const existing =
        map.get(key) ||
        {
          driverId: key,
          name: t.driver?.name || t.driver?.email || "Unknown driver",
          totalHours: 0,
          drivingHours: 0,
          stopHours: 0,
          mileage: 0,
          days: 0,
          stops: 0,
          missingMileageDays: 0,
        };
      existing.totalHours += Number(t.total_hours) || 0;
      existing.drivingHours += Number(t.driving_hours) || 0;
      existing.stopHours += Number(t.stop_hours) || 0;
      existing.mileage += Number(t.mileage) || 0;
      existing.stops += Number(t.total_stops) || 0;
      existing.days += 1;
      if (!t.mileage) existing.missingMileageDays += 1;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [timeslips]);

  const grand = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          totalHours: acc.totalHours + r.totalHours,
          drivingHours: acc.drivingHours + r.drivingHours,
          stopHours: acc.stopHours + r.stopHours,
          mileage: acc.mileage + r.mileage,
          days: acc.days + r.days,
          stops: acc.stops + r.stops,
        }),
        { totalHours: 0, drivingHours: 0, stopHours: 0, mileage: 0, days: 0, stops: 0 }
      ),
    [rows]
  );

  const isDefaultRange = dateFrom === defaults.from && dateTo === defaults.to;

  const MissingMileageHint = ({ count }: { count: number }) =>
    count > 0 ? (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-0.5 cursor-help text-amber-500">*</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {count} day{count === 1 ? "" : "s"} with no mileage recorded
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : null;

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold whitespace-nowrap">
              Driver hours &amp; mileage
            </CardTitle>
            <span className="hidden sm:inline text-xs text-muted-foreground truncate">
              {format(new Date(dateFrom), "d MMM")} –{" "}
              {format(new Date(dateTo), "d MMM yyyy")}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="dhm-from" className="text-[10px] text-muted-foreground whitespace-nowrap">
                From
              </Label>
              <Input
                id="dhm-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-7 w-[8.5rem] text-xs px-2 py-0"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="dhm-to" className="text-[10px] text-muted-foreground whitespace-nowrap">
                To
              </Label>
              <Input
                id="dhm-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-7 w-[8.5rem] text-xs px-2 py-0"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              disabled={isDefaultRange}
              onClick={() => {
                setDateFrom(defaults.from);
                setDateTo(defaults.to);
              }}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3 pt-0">
        {isLoading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-3">
            No timeslips found for this date range.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-6 py-0 text-[10px] uppercase tracking-wide">Driver</TableHead>
                    <TableHead className="h-6 py-0 text-[10px] uppercase tracking-wide text-right">Hours</TableHead>
                    <TableHead className="h-6 py-0 text-[10px] uppercase tracking-wide text-right">Mileage</TableHead>
                    <TableHead className="h-6 py-0 text-[10px] uppercase tracking-wide text-right">Days</TableHead>
                    <TableHead className="h-6 py-0 text-[10px] uppercase tracking-wide text-right">Stops</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.driverId} className="h-7">
                      <TableCell className="py-0 text-xs font-medium truncate max-w-[14rem]">
                        {r.name}
                      </TableCell>
                      <TableCell className="py-0 text-xs text-right whitespace-nowrap">
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">
                                <span className="font-semibold">{fmtHours(r.totalHours)}</span>
                                <span className="text-muted-foreground ml-1 text-[10px]">
                                  ({fmtHours(r.drivingHours)}/{fmtHours(r.stopHours)})
                                </span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Driving {fmtHours(r.drivingHours)} · Stops {fmtHours(r.stopHours)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="py-0 text-xs text-right whitespace-nowrap">
                        {r.mileage > 0 ? fmtMiles(r.mileage) : "—"}
                        <MissingMileageHint count={r.missingMileageDays} />
                      </TableCell>
                      <TableCell className="py-0 text-xs text-right">{r.days}</TableCell>
                      <TableCell className="py-0 text-xs text-right">{r.stops}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="h-7 hover:bg-transparent">
                    <TableCell className="py-0 text-xs font-semibold">Total</TableCell>
                    <TableCell className="py-0 text-xs text-right font-semibold whitespace-nowrap">
                      {fmtHours(grand.totalHours)}
                      <span className="text-muted-foreground ml-1 text-[10px]">
                        ({fmtHours(grand.drivingHours)}/{fmtHours(grand.stopHours)})
                      </span>
                    </TableCell>
                    <TableCell className="py-0 text-xs text-right font-semibold whitespace-nowrap">
                      {grand.mileage > 0 ? fmtMiles(grand.mileage) : "—"}
                    </TableCell>
                    <TableCell className="py-0 text-xs text-right font-semibold">{grand.days}</TableCell>
                    <TableCell className="py-0 text-xs text-right font-semibold">{grand.stops}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden">
              {rows.map((r) => (
                <div
                  key={r.driverId}
                  className="flex items-center justify-between py-1.5 border-b last:border-b-0 text-xs"
                >
                  <div className="font-medium truncate pr-2 min-w-0">{r.name}</div>
                  <div className="flex items-center gap-2 shrink-0">
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-semibold cursor-help whitespace-nowrap">
                            {fmtHours(r.totalHours)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          Driving {fmtHours(r.drivingHours)} · Stops {fmtHours(r.stopHours)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span className="text-muted-foreground whitespace-nowrap w-12 text-right">
                      {r.mileage > 0 ? fmtMiles(r.mileage) : "—"}
                      <MissingMileageHint count={r.missingMileageDays} />
                    </span>
                    <span className="text-muted-foreground w-6 text-right">{r.days}d</span>
                    <span className="text-muted-foreground w-6 text-right">{r.stops}s</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between py-1.5 border-t mt-1 font-semibold text-xs">
                <div>Total</div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="whitespace-nowrap">{fmtHours(grand.totalHours)}</span>
                  <span className="whitespace-nowrap w-12 text-right">
                    {grand.mileage > 0 ? fmtMiles(grand.mileage) : "—"}
                  </span>
                  <span className="w-6 text-right">{grand.days}d</span>
                  <span className="w-6 text-right">{grand.stops}s</span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DriverHoursMileagePanel;
