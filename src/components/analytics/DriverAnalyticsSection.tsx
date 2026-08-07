import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subWeeks } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, Clock, PoundSterling, Package, Truck, Target, Route, Gauge, Bike } from "lucide-react";
import StatsCard from "./StatsCard";
import DriverPayRateChart from "./DriverPayRateChart";
import DriverWeeklyPayslipsTable from "./DriverWeeklyPayslipsTable";
import DriverBikesChart from "./DriverBikesChart";
import DriverOnTimeCard from "./DriverOnTimeCard";
import DriverHeatMap from "./DriverHeatMap";
import DriverLeaderboardCard from "./DriverLeaderboardCard";
import {
  fetchDrivers,
  fetchDriverTimeslips,
  fetchDriverFirstDates,
  fetchOrdersForDrivers,
  driverNameVariants,
  getWeeklyPayslips,
  getPayRateHistory,
  getBikeCounts,
  getOnTimeStats,
  getHeatPoints,
  getDriverSummary,
  getDriverLeaderboard,
  formatTenure,
} from "@/services/driverAnalyticsService";

const DriverAnalyticsSection = () => {
  const today = new Date();
  const [from, setFrom] = useState(format(subWeeks(today, 12), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(today, "yyyy-MM-dd"));
  const [driverId, setDriverId] = useState<string | null>(null);

  const range = { start: from, end: to };
  const setWeeks = (weeks: number) => {
    setFrom(format(subWeeks(new Date(), weeks), "yyyy-MM-dd"));
    setTo(format(new Date(), "yyyy-MM-dd"));
  };

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["driverAnalytics", "drivers"],
    queryFn: fetchDrivers,
  });

  const { data: timeslips = [], isLoading: tsLoading } = useQuery({
    queryKey: ["driverAnalytics", "timeslips", from, to],
    queryFn: () => fetchDriverTimeslips(range),
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["driverAnalytics", "orders", from, to],
    queryFn: () => fetchOrdersForDrivers(range),
  });

  const { data: firstDates = {} } = useQuery({
    queryKey: ["driverAnalytics", "firstDates"],
    queryFn: fetchDriverFirstDates,
  });

  const selectedDriver = useMemo(
    () => drivers.find((d) => d.id === driverId) ?? drivers[0] ?? null,
    [drivers, driverId],
  );

  const driverRows = useMemo(
    () => (selectedDriver ? timeslips.filter((t) => t.driver_id === selectedDriver.id) : []),
    [timeslips, selectedDriver],
  );

  const variants = useMemo(
    () => (selectedDriver ? driverNameVariants(selectedDriver) : new Set<string>()),
    [selectedDriver],
  );

  const summary = useMemo(() => getDriverSummary(driverRows), [driverRows]);
  const payslips = useMemo(() => getWeeklyPayslips(driverRows), [driverRows]);
  const rateHistory = useMemo(() => getPayRateHistory(driverRows), [driverRows]);
  const bikeCounts = useMemo(() => getBikeCounts(orders, variants), [orders, variants]);
  const onTime = useMemo(() => getOnTimeStats(orders, variants), [orders, variants]);
  const heatPoints = useMemo(() => getHeatPoints(driverRows), [driverRows]);
  const leaderboard = useMemo(() => getDriverLeaderboard(drivers, timeslips, orders), [drivers, timeslips, orders]);

  const loading = driversLoading || tsLoading || ordersLoading;
  const tenureFrom = selectedDriver ? firstDates[selectedDriver.id] ?? selectedDriver.created_at : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Driver Analytics</CardTitle>
          <CardDescription>
            Pick a driver and a period to see tenure, pay history, volumes, punctuality and where they work.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="min-w-0 sm:w-64">
            <Label>Driver</Label>
            <Select value={selectedDriver?.id ?? ""} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue placeholder={driversLoading ? "Loading…" : "Select a driver"} />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                    {d.is_active === false ? " (inactive)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full sm:w-40" />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full sm:w-40" />
          </div>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" onClick={() => setWeeks(4)}>4w</Button>
            <Button size="sm" variant="outline" onClick={() => setWeeks(12)}>12w</Button>
            <Button size="sm" variant="outline" onClick={() => setWeeks(26)}>26w</Button>
            <Button size="sm" variant="outline" onClick={() => setWeeks(52)}>1y</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !selectedDriver ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No users hold the driver role yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
            <StatsCard
              title="Tenure"
              value={formatTenure(tenureFrom)}
              description={tenureFrom ? `Since ${format(new Date(`${tenureFrom.slice(0, 10)}T00:00:00`), "dd MMM yyyy")}` : "No history"}
              icon={CalendarClock}
            />
            <StatsCard
              title="Days Worked"
              value={summary.days}
              description={`Avg ${summary.avgHoursPerDay.toFixed(1)} h/day`}
              icon={Clock}
            />
            <StatsCard
              title="Total Pay"
              value={`£${summary.pay.toLocaleString("en-GB")}`}
              description={`Avg £${summary.avgPayPerDay}/day`}
              icon={PoundSterling}
            />
            <StatsCard
              title="Bikes Collected"
              value={bikeCounts.collected}
              description="Jobs where they did the collection"
              icon={Package}
            />
            <StatsCard
              title="Bikes Delivered"
              value={bikeCounts.delivered}
              description="Jobs where they did the delivery"
              icon={Truck}
            />
            <StatsCard
              title="On-Time Rate"
              value={onTime.onTime + onTime.early + onTime.late > 0 ? `${onTime.rate}%` : "—"}
              description={`${onTime.onTime + onTime.early + onTime.late} legs measured · ${onTime.noData} no data`}
              icon={Target}
            />
            <StatsCard
              title="Total Miles"
              value={summary.miles.toLocaleString("en-GB")}
              description={`${summary.milesPerStop.toFixed(1)} miles per stop`}
              icon={Route}
            />
            <StatsCard
              title="Stops / Hour"
              value={summary.stopsPerHour.toFixed(2)}
              description={`Avg ${summary.avgStopsPerDay.toFixed(1)} stops/day`}
              icon={Gauge}
            />
            <StatsCard
              title="Current Rate"
              value={summary.currentRate != null ? `£${summary.currentRate.toFixed(2)}` : "—"}
              description={summary.currentVanAllowance ? `+ £${summary.currentVanAllowance} van allowance` : "No van allowance"}
              icon={PoundSterling}
            />
            <StatsCard
              title="Data Gaps"
              value={`${summary.missingMileageDays} / ${summary.noVehicleDays}`}
              description="Days missing mileage / no vehicle assigned"
              icon={Bike}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:gap-4">
            <DriverPayRateChart data={rateHistory} />
            <DriverWeeklyPayslipsTable weeks={payslips} />
            <DriverBikesChart data={bikeCounts.weekly} />
            <DriverOnTimeCard stats={onTime} />
            <DriverHeatMap points={heatPoints} />
          </div>

          <Separator />

          <DriverLeaderboardCard rows={leaderboard} />
        </>
      )}
    </div>
  );
};

export default DriverAnalyticsSection;
