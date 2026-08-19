import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, startOfWeek, subWeeks } from "date-fns";
import { CalendarDays, Gauge, RotateCcw, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

// Default range: Sunday -> Thursday of the current working week.
// On Friday/Saturday, show the week that has just finished.
const getDefaultRange = (): { from: string; to: string } => {
  const today = new Date();
  const dow = today.getDay(); // 0 = Sunday
  const base = dow === 5 || dow === 6 ? subWeeks(today, 0) : today;
  let sunday = startOfWeek(base, { weekStartsOn: 0 });
  if (dow === 5 || dow === 6) {
    // week just finished still starts on the same Sunday
    sunday = startOfWeek(base, { weekStartsOn: 0 });
  }
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Driver hours &amp; mileage
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Totals from driver timeslips ({format(new Date(dateFrom), "d MMM")} –{" "}
              {format(new Date(dateTo), "d MMM yyyy")})
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="dhm-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input
                id="dhm-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 w-[9.5rem]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dhm-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input
                id="dhm-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 w-[9.5rem]"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={isDefaultRange}
              onClick={() => {
                setDateFrom(defaults.from);
                setDateTo(defaults.to);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset to Sun–Thu
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            No timeslips found for this date range.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead className="text-right">Total hours</TableHead>
                    <TableHead className="text-right">Driving / Stops</TableHead>
                    <TableHead className="text-right">Mileage</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead className="text-right">Stops</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.driverId}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmtHours(r.totalHours)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {fmtHours(r.drivingHours)} / {fmtHours(r.stopHours)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.mileage > 0 ? fmtMiles(r.mileage) : "—"}
                        {r.missingMileageDays > 0 && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {r.missingMileageDays} day
                            {r.missingMileageDays === 1 ? "" : "s"} no mileage
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{r.days}</TableCell>
                      <TableCell className="text-right">{r.stops}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">All drivers</TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmtHours(grand.totalHours)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {fmtHours(grand.drivingHours)} / {fmtHours(grand.stopHours)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {grand.mileage > 0 ? fmtMiles(grand.mileage) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{grand.days}</TableCell>
                    <TableCell className="text-right">{grand.stops}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {rows.map((r) => (
                <div key={r.driverId} className="rounded-md border p-3">
                  <div className="font-medium break-words">{r.name}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-semibold">{fmtHours(r.totalHours)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{r.mileage > 0 ? fmtMiles(r.mileage) : "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>
                        {r.days} day{r.days === 1 ? "" : "s"} · {r.stops} stops
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      Drive {fmtHours(r.drivingHours)} · Stops {fmtHours(r.stopHours)}
                    </div>
                  </div>
                  {r.missingMileageDays > 0 && (
                    <Badge variant="outline" className="mt-2 text-[10px]">
                      {r.missingMileageDays} day{r.missingMileageDays === 1 ? "" : "s"} no mileage
                    </Badge>
                  )}
                </div>
              ))}
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="font-semibold mb-1">All drivers</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>{fmtHours(grand.totalHours)} total</span>
                  <span>{grand.mileage > 0 ? fmtMiles(grand.mileage) : "—"}</span>
                  <span>
                    {grand.days} day{grand.days === 1 ? "" : "s"}
                  </span>
                  <span>{grand.stops} stops</span>
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
