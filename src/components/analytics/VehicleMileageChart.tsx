import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { Vehicle } from "@/services/vehicleService";
import {
  getWeeklyMileageByVehicle,
  type TimeslipRow,
} from "@/services/vehicleAnalyticsService";

interface Props {
  rows: TimeslipRow[];
  vehicles: Vehicle[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
}

const colorFor = (i: number) => `hsl(${(i * 53) % 360} 65% 50%)`;

const VehicleMileageChart = ({ rows, vehicles, selectedIds, onSelectedIdsChange }: Props) => {
  const [open, setOpen] = useState(false);

  const lookup = useMemo(() => {
    const o: Record<string, { registration: string }> = {};
    for (const v of vehicles) o[v.id] = { registration: v.registration };
    return o;
  }, [vehicles]);

  const data = useMemo(
    () => getWeeklyMileageByVehicle(rows, selectedIds, lookup),
    [rows, selectedIds, lookup],
  );

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectedIdsChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectedIdsChange([...selectedIds, id]);
    }
  };

  const selectedRegs = selectedIds.map((id) => lookup[id]?.registration ?? "?");

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
        <CardTitle className="text-base sm:text-lg">Mileage per Vehicle</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="justify-between min-w-[180px]">
                {selectedIds.length === 0
                  ? "Select vehicles"
                  : `${selectedIds.length} selected`}
                <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <div className="flex items-center justify-between p-2 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectedIdsChange(vehicles.map((v) => v.id))}
                >
                  Select all
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onSelectedIdsChange([])}>
                  Clear
                </Button>
              </div>
              <div className="max-h-72 overflow-y-auto p-1">
                {vehicles.map((v) => {
                  const checked = selectedIds.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggle(v.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                    >
                      <Checkbox checked={checked} className="pointer-events-none" />
                      <span className="font-mono font-medium">{v.registration}</span>
                      <span className="text-muted-foreground text-xs truncate">
                        {v.make ?? ""}
                      </span>
                      {checked && <Check className="h-3 w-3 ml-auto text-primary" />}
                    </button>
                  );
                })}
                {vehicles.length === 0 && (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    No vehicles
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        {selectedRegs.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {selectedRegs.map((r) => (
              <Badge key={r} variant="secondary" className="font-mono text-xs">
                {r}
              </Badge>
            ))}
          </div>
        )}
        <div className="w-full h-[320px]">
          {selectedIds.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Select one or more vehicles to compare mileage
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Legend />
                {selectedIds.map((id, i) => {
                  const reg = lookup[id]?.registration ?? "Unknown";
                  return (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={reg}
                      name={reg}
                      stroke={colorFor(i)}
                      strokeWidth={2}
                      dot={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VehicleMileageChart;
