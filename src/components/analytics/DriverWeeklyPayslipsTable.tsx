import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { WeeklyPayslip } from "@/services/driverAnalyticsService";

interface Props {
  weeks: WeeklyPayslip[];
}

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });

const DriverWeeklyPayslipsTable = ({ weeks }: Props) => {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const totals = weeks.reduce(
    (acc, w) => ({
      days: acc.days + w.days,
      hours: acc.hours + w.hours,
      stops: acc.stops + w.stops,
      bikes: acc.bikes + w.bikes,
      miles: acc.miles + w.miles,
      pay: acc.pay + w.pay,
    }),
    { days: 0, hours: 0, stops: 0, bikes: 0, miles: 0, pay: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Weekly Pay Slips (Mon–Sun)</CardTitle>
        <CardDescription>Approved timeslips grouped into weeks — tap a week to see the days behind it</CardDescription>
      </CardHeader>
      <CardContent>
        {weeks.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No approved timeslips in this period</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Stops</TableHead>
                  <TableHead className="text-right">Bikes</TableHead>
                  <TableHead className="text-right">Miles</TableHead>
                  <TableHead className="text-right">Van</TableHead>
                  <TableHead className="text-right">Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeks.map((w) => (
                  <>
                    <TableRow key={w.week} className="cursor-pointer" onClick={() => setOpen((o) => ({ ...o, [w.week]: !o[w.week] }))}>
                      <TableCell className="font-medium whitespace-nowrap">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mr-1">
                          {open[w.week] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                        w/c {w.label}
                      </TableCell>
                      <TableCell className="text-right">{w.days}</TableCell>
                      <TableCell className="text-right">{w.hours.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{w.stops}</TableCell>
                      <TableCell className="text-right">{w.bikes}</TableCell>
                      <TableCell className="text-right">{Math.round(w.miles).toLocaleString("en-GB")}</TableCell>
                      <TableCell className="text-right">£{Math.round(w.vanAllowance)}</TableCell>
                      <TableCell className="text-right font-medium">£{Math.round(w.pay).toLocaleString("en-GB")}</TableCell>
                    </TableRow>
                    {open[w.week] &&
                      [...w.rows]
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((r) => (
                          <TableRow key={r.id} className="bg-muted/40">
                            <TableCell className="pl-10 text-xs whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                            <TableCell className="text-right text-xs">—</TableCell>
                            <TableCell className="text-right text-xs">{Number(r.total_hours || 0).toFixed(1)}</TableCell>
                            <TableCell className="text-right text-xs">{r.total_stops ?? 0}</TableCell>
                            <TableCell className="text-right text-xs">{r.total_jobs ?? 0}</TableCell>
                            <TableCell className="text-right text-xs">{Math.round(Number(r.mileage || 0))}</TableCell>
                            <TableCell className="text-right text-xs">£{Math.round(Number(r.van_allowance || 0))}</TableCell>
                            <TableCell className="text-right text-xs">£{Math.round(Number(r.total_pay || 0))}</TableCell>
                          </TableRow>
                        ))}
                  </>
                ))}
                <TableRow className="font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{totals.days}</TableCell>
                  <TableCell className="text-right">{totals.hours.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{totals.stops}</TableCell>
                  <TableCell className="text-right">{totals.bikes}</TableCell>
                  <TableCell className="text-right">{Math.round(totals.miles).toLocaleString("en-GB")}</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">£{Math.round(totals.pay).toLocaleString("en-GB")}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DriverWeeklyPayslipsTable;
