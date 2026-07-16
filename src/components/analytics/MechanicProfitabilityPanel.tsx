import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wrench } from 'lucide-react';
import { getMechanicProfitability } from '@/services/mechanicProfitabilityService';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Props {
  initialFrom?: Date;
  initialTo?: Date;
}

const fmtGBP = (n: number) =>
  n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 });

const MechanicProfitabilityPanel: React.FC<Props> = ({ initialFrom, initialTo }) => {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState<string>(format(initialFrom || monthStart, 'yyyy-MM-dd'));
  const [to, setTo] = useState<string>(format(initialTo || today, 'yyyy-MM-dd'));

  const fromISO = new Date(`${from}T00:00:00.000Z`).toISOString();
  const toISO = new Date(`${to}T23:59:59.999Z`).toISOString();

  const { data: rows, isLoading } = useQuery({
    queryKey: ['mechanic-profitability', fromISO, toISO],
    queryFn: () => getMechanicProfitability(fromISO, toISO),
  });

  const totals = (rows || []).reduce(
    (acc, r) => {
      acc.inspectionsDone += r.inspectionsDone;
      acc.inspectionRevenue += r.inspectionRevenue;
      acc.repairsDone += r.repairsDone;
      acc.repairRevenue += r.repairRevenue;
      acc.labourRevenue += r.labourRevenue;
      acc.totalRevenue += r.totalRevenue;
      acc.hoursWorked += r.hoursWorked;
      acc.wageCost += r.wageCost;
      acc.profit += r.profit;
      acc.labourProfit += r.labourProfit;
      return acc;
    },
    { inspectionsDone: 0, inspectionRevenue: 0, repairsDone: 0, repairRevenue: 0, labourRevenue: 0, totalRevenue: 0, hoursWorked: 0, wageCost: 0, profit: 0, labourProfit: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Mechanic Profitability
        </CardTitle>
        <CardDescription>
          Revenue attributed to each mechanic (£60 per inspection released + repair value on issues they resolved),
          minus wage cost from mechanic timeslips.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-6">Loading…</p>
        ) : rows && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mechanic</TableHead>
                  <TableHead className="text-right">Inspections</TableHead>
                  <TableHead className="text-right">Inspection £</TableHead>
                  <TableHead className="text-right">Repairs</TableHead>
                  <TableHead className="text-right">Repair £</TableHead>
                  <TableHead className="text-right">Total revenue</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Wage cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.mechanicId}>
                    <TableCell className="font-medium">{r.mechanicName}</TableCell>
                    <TableCell className="text-right">{r.inspectionsDone}</TableCell>
                    <TableCell className="text-right">{fmtGBP(r.inspectionRevenue)}</TableCell>
                    <TableCell className="text-right">{r.repairsDone}</TableCell>
                    <TableCell className="text-right">{fmtGBP(r.repairRevenue)}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">{fmtGBP(r.totalRevenue)}</TableCell>
                    <TableCell className="text-right">{r.hoursWorked.toFixed(1)}</TableCell>
                    <TableCell className="text-right text-orange-600">{fmtGBP(r.wageCost)}</TableCell>
                    <TableCell className={cn('text-right font-bold', r.profit >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {fmtGBP(r.profit)}
                    </TableCell>
                    <TableCell className="text-right">{r.totalRevenue > 0 ? `${r.margin.toFixed(0)}%` : '—'}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{totals.inspectionsDone}</TableCell>
                  <TableCell className="text-right">{fmtGBP(totals.inspectionRevenue)}</TableCell>
                  <TableCell className="text-right">{totals.repairsDone}</TableCell>
                  <TableCell className="text-right">{fmtGBP(totals.repairRevenue)}</TableCell>
                  <TableCell className="text-right text-green-600">{fmtGBP(totals.totalRevenue)}</TableCell>
                  <TableCell className="text-right">{totals.hoursWorked.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-orange-600">{fmtGBP(totals.wageCost)}</TableCell>
                  <TableCell className={cn('text-right', totals.profit >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {fmtGBP(totals.profit)}
                  </TableCell>
                  <TableCell className="text-right">
                    {totals.totalRevenue > 0 ? `${((totals.profit / totals.totalRevenue) * 100).toFixed(0)}%` : '—'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-6">No mechanic activity in this date range.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default MechanicProfitabilityPanel;
