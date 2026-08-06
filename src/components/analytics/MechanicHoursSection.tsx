import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Clock, ClipboardCheck, Wrench, Gauge } from 'lucide-react';
import { format, subWeeks } from 'date-fns';
import StatsCard from './StatsCard';
import { getMechanicHours } from '@/services/mechanicHoursService';

const MechanicHoursSection: React.FC = () => {
  const today = new Date();
  const [from, setFrom] = useState<string>(format(subWeeks(today, 4), 'yyyy-MM-dd'));
  const [to, setTo] = useState<string>(format(today, 'yyyy-MM-dd'));

  const setWeeks = (weeks: number) => {
    setFrom(format(subWeeks(new Date(), weeks), 'yyyy-MM-dd'));
    setTo(format(new Date(), 'yyyy-MM-dd'));
  };

  const fromISO = new Date(`${from}T00:00:00.000Z`).toISOString();
  const toISO = new Date(`${to}T23:59:59.999Z`).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['mechanic-hours', fromISO, toISO],
    queryFn: () => getMechanicHours(fromISO, toISO),
  });

  const totals = data?.totals;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Mechanic Hours
        </CardTitle>
        <CardDescription>
          Hours clocked on mechanic timeslips each day compared with inspections and repairs completed that day.
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
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" onClick={() => setWeeks(4)}>4w</Button>
            <Button size="sm" variant="outline" onClick={() => setWeeks(8)}>8w</Button>
            <Button size="sm" variant="outline" onClick={() => setWeeks(12)}>12w</Button>
          </div>
        </div>

        {totals && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <StatsCard title="Hours Clocked" value={totals.hours.toFixed(1)} description="Closed & approved timeslips" icon={Clock} />
            <StatsCard title="Inspections Done" value={totals.inspections} description="Completed in range" icon={ClipboardCheck} />
            <StatsCard title="Repairs Done" value={totals.repairs} description="Issues resolved in range" icon={Wrench} />
            <StatsCard
              title="Jobs / Hour"
              value={totals.jobsPerHour.toFixed(2)}
              description={totals.minutesPerJob > 0 ? `${totals.minutesPerJob.toFixed(0)} min per job` : 'No jobs in range'}
              icon={Gauge}
            />
          </div>
        )}

        {isLoading ? (
          <p className="text-muted-foreground text-center py-10">Loading…</p>
        ) : !data || data.daily.length === 0 ? (
          <p className="text-muted-foreground text-center py-10">No mechanic hours or workshop activity in this date range.</p>
        ) : (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.daily} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} angle={-45} textAnchor="end" height={60} />
                  <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="hours" name="Hours clocked" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="inspections" name="Inspections done" stroke="hsl(var(--chart-2, var(--accent)))" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="repairs" name="Repairs done" stroke="hsl(var(--destructive))" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {data.perMechanic.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mechanic</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Inspections</TableHead>
                      <TableHead className="text-right">Repairs</TableHead>
                      <TableHead className="text-right">Jobs / hour</TableHead>
                      <TableHead className="text-right">Min / job</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.perMechanic.map((m) => (
                      <TableRow key={m.mechanicId}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="text-right">{m.hours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{m.inspections}</TableCell>
                        <TableCell className="text-right">{m.repairs}</TableCell>
                        <TableCell className="text-right font-semibold">{m.hours > 0 ? m.jobsPerHour.toFixed(2) : '—'}</TableCell>
                        <TableCell className="text-right">{m.minutesPerJob > 0 ? m.minutesPerJob.toFixed(0) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-2">
                  Jobs = inspections completed + repairs resolved. Mechanics with hours but no jobs show as “—”.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MechanicHoursSection;
