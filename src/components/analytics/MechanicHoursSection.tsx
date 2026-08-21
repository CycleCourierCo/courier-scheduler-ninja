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
import { Badge } from '@/components/ui/badge';
import { Clock, ClipboardCheck, Wrench, Gauge, Timer, ChevronDown, ChevronRight } from 'lucide-react';
import { format, subWeeks } from 'date-fns';
import StatsCard from './StatsCard';
import { getMechanicHours, type StandardMinutesSource } from '@/services/mechanicHoursService';

const sourceLabel: Record<StandardMinutesSource, string> = {
  catalogue: 'Book time',
  labour_cost: 'From price',
  default: 'Fallback',
  inspection: 'Inspection',
};

const varianceClass = (v: number) =>
  v >= 0 ? 'text-green-600 dark:text-green-500' : 'text-destructive';
const fmtVariance = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}h`;

/** Day-by-day job breakdown for one mechanic — shared by the table and mobile cards. */
const DayBreakdown: React.FC<{ days: any[] }> = ({ days }) => {
  if (days.length === 0) {
    return <p className="text-sm text-muted-foreground">No days with activity.</p>;
  }
  return (
    <div className="space-y-3">
      {days.map((d) => (
        <div key={d.date} className="rounded-md border bg-background p-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-semibold">{d.label}</span>
            <span className="text-muted-foreground">Clocked {d.hours.toFixed(1)}h</span>
            <span className="text-muted-foreground">Earned {d.standardHours.toFixed(1)}h</span>
            <span className={`font-medium ${varianceClass(d.varianceHours)}`}>
              {fmtVariance(d.varianceHours)}
            </span>
            <span className="text-muted-foreground">{d.jobs.length} jobs</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Queue that day: {d.availableJobs} jobs / {d.hoursPossible.toFixed(1)}h
            {d.availableJobs > 0 && (
              <> (your share: {d.availableJobsShare.toFixed(1)} jobs / {d.hoursPossibleShare.toFixed(1)}h)</>
            )}
          </p>
          {d.jobs.length > 0 && (
            <ul className="mt-2 space-y-2">
              {d.jobs.map((j: any) => (
                <li key={`${j.type}-${j.id}`} className="border-t pt-2 first:border-t-0 first:pt-0 text-sm">
                  <div className="flex items-start gap-2">
                    {j.type === 'inspection' ? (
                      <ClipboardCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 break-words">{j.label}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 pl-5">
                    <Badge variant="outline" className="text-[10px]">
                      {sourceLabel[j.source as StandardMinutesSource]}
                    </Badge>
                    <span className="tabular-nums text-muted-foreground">{j.minutes} min</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

const MechanicHoursSection: React.FC = () => {

  const today = new Date();
  const [from, setFrom] = useState<string>(format(subWeeks(today, 4), 'yyyy-MM-dd'));
  const [to, setTo] = useState<string>(format(today, 'yyyy-MM-dd'));
  const [expanded, setExpanded] = useState<string | null>(null);

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
          Mechanic Hours vs. Work Done
        </CardTitle>
        <CardDescription>
          Hours clocked on mechanic timeslips compared with the standard (book) time the jobs completed are worth — so
          10 jobs worth 7 hours can be matched against the 7 hours clocked.
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
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              <StatsCard title="Hours Clocked" value={totals.hours.toFixed(1)} description="Closed & approved timeslips" icon={Clock} />
              <StatsCard
                title="Standard Hours Earned"
                value={totals.standardHours.toFixed(1)}
                description={`${totals.inspections + totals.repairs} jobs completed`}
                icon={Timer}
              />
              <StatsCard
                title="Variance"
                value={fmtVariance(totals.varianceHours)}
                description={totals.varianceHours >= 0 ? 'Earned at or above clocked time' : 'Less earned than clocked'}
                icon={Gauge}
              />
              <StatsCard
                title="Efficiency"
                value={totals.hours > 0 ? `${totals.efficiencyPct.toFixed(0)}%` : '—'}
                description="Earned ÷ clocked hours"
                icon={Gauge}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              <StatsCard title="Inspections Done" value={totals.inspections} description="Completed in range" icon={ClipboardCheck} />
              <StatsCard title="Repairs Done" value={totals.repairs} description="Issues resolved in range" icon={Wrench} />
              <StatsCard
                title="Jobs / Hour"
                value={totals.jobsPerHour.toFixed(2)}
                description={totals.minutesPerJob > 0 ? `${totals.minutesPerJob.toFixed(0)} min per job` : 'No jobs in range'}
                icon={Gauge}
              />
              <StatsCard
                title="Book-time Coverage"
                value={`${totals.catalogueCoveragePct.toFixed(0)}%`}
                description="Repairs priced from the labour catalogue"
                icon={Timer}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              <StatsCard
                title="Jobs Available (peak)"
                value={totals.availableJobs}
                description="Busiest day's queue: awaiting inspection or repair"
                icon={ClipboardCheck}
              />
              <StatsCard
                title="Hours Possible"
                value={totals.hoursPossible.toFixed(1)}
                description="Standard time in the queue across the period"
                icon={Timer}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Standard time uses labour catalogue book times where a repair is linked, otherwise it's estimated from the
              repair's labour price (at £{data?.settings.hourlyRate}/hr) or the workshop fallback of{' '}
              {data?.settings.defaultRepairMinutes} min. Each inspection counts as {data?.settings.inspectionMinutes} min.
            </p>
          </>
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
                  <Bar yAxisId="left" dataKey="standardHours" name="Standard hours earned" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="left" type="monotone" dataKey="hoursPossible" name="Hours possible (queue)" stroke="hsl(var(--primary))" strokeDasharray="4 3" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="inspections" name="Inspections done" stroke="hsl(var(--chart-2, var(--accent)))" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="repairs" name="Repairs done" stroke="hsl(var(--destructive))" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {data.perMechanic.length > 0 && (
              <div className="space-y-2">
                {/* Desktop: full table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mechanic</TableHead>
                        <TableHead className="text-right">Clocked (h)</TableHead>
                        <TableHead className="text-right">Standard (h)</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead className="text-right">Efficiency</TableHead>
                        <TableHead className="text-right">Jobs avail.</TableHead>
                        <TableHead className="text-right">Hours poss.</TableHead>
                        <TableHead className="text-right">Utilisation</TableHead>
                        <TableHead className="text-right">Inspections</TableHead>
                        <TableHead className="text-right">Repairs</TableHead>
                        <TableHead className="text-right">Min / job</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.perMechanic.map((m) => (
                        <React.Fragment key={m.mechanicId}>
                          <TableRow
                            className="cursor-pointer"
                            onClick={() => setExpanded(expanded === m.mechanicId ? null : m.mechanicId)}
                          >
                            <TableCell className="font-medium">
                              <span className="inline-flex items-center gap-1">
                                {expanded === m.mechanicId ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                {m.name}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{m.hours.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{m.standardHours.toFixed(1)}</TableCell>
                            <TableCell className={`text-right font-semibold ${varianceClass(m.varianceHours)}`}>
                              {fmtVariance(m.varianceHours)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {m.hours > 0 ? `${m.efficiencyPct.toFixed(0)}%` : '—'}
                            </TableCell>
                            <TableCell className="text-right">{m.availableJobsShare.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{m.hoursPossibleShare.toFixed(1)}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {m.hoursPossibleShare > 0 ? `${m.utilisationPct.toFixed(0)}%` : '—'}
                            </TableCell>
                            <TableCell className="text-right">{m.inspections}</TableCell>
                            <TableCell className="text-right">{m.repairs}</TableCell>
                            <TableCell className="text-right">{m.minutesPerJob > 0 ? m.minutesPerJob.toFixed(0) : '—'}</TableCell>
                          </TableRow>
                          {expanded === m.mechanicId && (
                            <TableRow>
                              <TableCell colSpan={11} className="bg-muted/40">
                                <DayBreakdown days={m.days} />
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile: stacked cards, no sideways scrolling */}
                <div className="md:hidden space-y-2">
                  {data.perMechanic.map((m) => (
                    <div key={m.mechanicId} className="rounded-lg border">
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === m.mechanicId ? null : m.mechanicId)}
                        className="flex w-full items-center gap-2 p-3 text-left"
                      >
                        {expanded === m.mechanicId ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1 break-words font-medium">{m.name}</span>
                        <span className={`shrink-0 text-sm font-semibold ${varianceClass(m.varianceHours)}`}>
                          {fmtVariance(m.varianceHours)}
                        </span>
                      </button>

                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t px-3 py-2 text-sm">
                        <dt className="text-muted-foreground">Clocked</dt>
                        <dd className="text-right tabular-nums">{m.hours.toFixed(1)}h</dd>
                        <dt className="text-muted-foreground">Earned</dt>
                        <dd className="text-right tabular-nums">{m.standardHours.toFixed(1)}h</dd>
                        <dt className="text-muted-foreground">Efficiency</dt>
                        <dd className="text-right font-semibold tabular-nums">
                          {m.hours > 0 ? `${m.efficiencyPct.toFixed(0)}%` : '—'}
                        </dd>
                        <dt className="text-muted-foreground">Jobs available</dt>
                        <dd className="text-right tabular-nums">{m.availableJobsShare.toFixed(1)}</dd>
                        <dt className="text-muted-foreground">Hours possible</dt>
                        <dd className="text-right tabular-nums">{m.hoursPossibleShare.toFixed(1)}h</dd>
                        <dt className="text-muted-foreground">Utilisation</dt>
                        <dd className="text-right font-semibold tabular-nums">
                          {m.hoursPossibleShare > 0 ? `${m.utilisationPct.toFixed(0)}%` : '—'}
                        </dd>
                        <dt className="text-muted-foreground">Inspections</dt>
                        <dd className="text-right tabular-nums">{m.inspections}</dd>
                        <dt className="text-muted-foreground">Repairs</dt>
                        <dd className="text-right tabular-nums">{m.repairs}</dd>
                        <dt className="text-muted-foreground">Min / job</dt>
                        <dd className="text-right tabular-nums">
                          {m.minutesPerJob > 0 ? m.minutesPerJob.toFixed(0) : '—'}
                        </dd>
                      </dl>

                      {expanded === m.mechanicId && (
                        <div className="border-t bg-muted/40 p-3">
                          <DayBreakdown days={m.days} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground">
                  Tap a mechanic to see the day-by-day breakdown and the jobs that made up their earned hours.
                  Efficiency above 100% means they completed more standard time than they clocked.
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
