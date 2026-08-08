import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { DriverLeaderboardRow } from "@/services/driverAnalyticsService";

type SortKey = keyof Pick<
  DriverLeaderboardRow,
  "name" | "days" | "hours" | "stops" | "bikes" | "miles" | "pay" | "payPerBike" | "stopsPerHour" | "onTimeRate"
>;

interface Props {
  rows: DriverLeaderboardRow[];
}

const columns: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "Driver" },
  { key: "days", label: "Days", align: "right" },
  { key: "hours", label: "Hours", align: "right" },
  { key: "stops", label: "Stops", align: "right" },
  { key: "bikes", label: "Bikes", align: "right" },
  { key: "miles", label: "Miles", align: "right" },
  { key: "pay", label: "Pay", align: "right" },
  { key: "payPerBike", label: "£ / bike", align: "right" },
  { key: "stopsPerHour", label: "Stops / hr", align: "right" },
  { key: "onTimeRate", label: "On-time", align: "right" },
];

const DriverLeaderboardCard = ({ rows }: Props) => {
  const [sortKey, setSortKey] = useState<SortKey>("bikes");
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv)) * (asc ? 1 : -1);
      }
      const an = av == null ? -1 : Number(av);
      const bn = bv == null ? -1 : Number(bv);
      return (an - bn) * (asc ? 1 : -1);
    });
    return copy;
  }, [rows, sortKey, asc]);

  const toggle = (key: SortKey) => {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(key === "name");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Driver Leaderboard</CardTitle>
        <CardDescription>All drivers in the selected period — tap a column to sort</CardDescription>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No driver activity in this period</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key} className={c.align === "right" ? "text-right" : ""}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-1 -mx-1 font-medium"
                        onClick={() => toggle(c.key)}
                      >
                        {c.label}
                        {sortKey === c.key &&
                          (asc ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />)}
                      </Button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.driver_id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{r.days}</TableCell>
                    <TableCell className="text-right">{r.hours.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{r.stops}</TableCell>
                    <TableCell className="text-right">{r.bikes}</TableCell>
                    <TableCell className="text-right">{r.miles.toLocaleString("en-GB")}</TableCell>
                    <TableCell className="text-right">£{r.pay.toLocaleString("en-GB")}</TableCell>
                    <TableCell className="text-right">£{r.payPerBike.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{r.stopsPerHour.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{r.onTimeRate == null ? "—" : `${r.onTimeRate}%`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DriverLeaderboardCard;
