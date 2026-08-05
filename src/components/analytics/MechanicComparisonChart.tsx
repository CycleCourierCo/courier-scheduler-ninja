import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { getMechanicProfitability } from '@/services/mechanicProfitabilityService';

const fmtGBP = (n: number) =>
  n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

type Mode = 'money' | 'efficiency';

const MechanicComparisonChart: React.FC = () => {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState<string>(format(monthStart, 'yyyy-MM-dd'));
  const [to, setTo] = useState<string>(format(today, 'yyyy-MM-dd'));
  const [mode, setMode] = useState<Mode>('money');

  const fromISO = new Date(`${from}T00:00:00.000Z`).toISOString();
  const toISO = new Date(`${to}T23:59:59.999Z`).toISOString();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['mechanic-profitability', fromISO, toISO],
    queryFn: () => getMechanicProfitability(fromISO, toISO),
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.totalRevenue += r.totalRevenue;
      acc.labourRevenue += r.labourRevenue;
      acc.wageCost += r.wageCost;
      acc.profit += r.profit;
      acc.hoursWorked += r.hoursWorked;
      return acc;
    },
    { totalRevenue: 0, labourRevenue: 0, wageCost: 0, profit: 0, hoursWorked: 0 }
  );

  const data = rows.map((r) => ({
    name: r.mechanicName,
    totalRevenue: Math.round(r.totalRevenue),
    labourRevenue: Math.round(r.labourRevenue),
    wageCost: Math.round(r.wageCost),
    profit: Math.round(r.profit),
    revenuePerHour: r.hoursWorked > 0 ? Math.round(r.totalRevenue / r.hoursWorked) : 0,
    profitPerHour: r.hoursWorked > 0 ? Math.round(r.profit / r.hoursWorked) : 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mechanic Comparison</CardTitle>
        <CardDescription>
          {fmtGBP(totals.totalRevenue)} revenue · {fmtGBP(totals.labourRevenue)} labour · {fmtGBP(totals.wageCost)} wages ·{' '}
          {fmtGBP(totals.profit)} profit · {totals.hoursWorked.toFixed(1)} hours
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
          <div className="flex gap-1">
            <Button size="sm" variant={mode === 'money' ? 'default' : 'outline'} onClick={() => setMode('money')}>
              Revenue &amp; profit
            </Button>
            <Button size="sm" variant={mode === 'efficiency' ? 'default' : 'outline'} onClick={() => setMode('efficiency')}>
              Efficiency
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-10">Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-muted-foreground text-center py-10">No mechanic activity in this date range.</p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `£${v}`} />
                <Tooltip formatter={(v: number) => fmtGBP(Number(v))} />
                <Legend />
                {mode === 'money' ? (
                  <>
                    <Bar dataKey="totalRevenue" name="Total revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="labourRevenue" name="Labour revenue" fill="hsl(var(--chart-2, var(--accent)))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="wageCost" name="Wage cost" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="Profit" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                  </>
                ) : (
                  <>
                    <Bar dataKey="revenuePerHour" name="Revenue / hour" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profitPerHour" name="Profit / hour" fill="hsl(var(--chart-2, var(--accent)))" radius={[4, 4, 0, 0]} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MechanicComparisonChart;
