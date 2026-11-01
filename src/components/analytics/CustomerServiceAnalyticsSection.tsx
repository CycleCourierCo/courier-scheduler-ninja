import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildReport, formatMins, type CsConv, type CsMsg } from "@/lib/csAnalytics";
import { useCannedResponses } from "@/hooks/useCannedResponses";
import { ConfidenceBadge, useCannedStats } from "@/components/inbox/CannedConfidence";

const RANGES = [{ label: "7 days", days: 7 }, { label: "30 days", days: 30 }, { label: "90 days", days: 90 }, { label: "1 year", days: 365 }];

async function fetchAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

function Kpi({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
  return (
    <Card><CardContent className="p-3 sm:p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-xl sm:text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </CardContent></Card>
  );
}

export default function CustomerServiceAnalyticsSection() {
  const [days, setDays] = useState(30);
  const since = useMemo(() => subDays(new Date(), days).toISOString(), [days]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cs-analytics", days],
    queryFn: async () => {
      const convs = await fetchAll<CsConv>((f, t) => supabase.from("cs_conversations")
        .select("id, channel, status, priority, queue_id, assignee_id, created_at, closed_at, first_response_due_at, linked_order_id, subject")
        .gte("created_at", since).order("created_at").range(f, t));
      const ids = convs.map((c) => c.id);
      const msgs: CsMsg[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        msgs.push(...await fetchAll<CsMsg>((f, t) => supabase.from("cs_messages")
          .select("conversation_id, direction, author_id, created_at, is_automatic, system_event, delivery_status, sent_via, body_text, status")
          .in("conversation_id", chunk).order("created_at").range(f, t)));
      }
      const [{ data: queues }, people] = await Promise.all([
        supabase.from("cs_queues").select("id, name"),
        (async () => {
          const pids = [...new Set([...msgs.map((m) => m.author_id), ...convs.map((c) => c.assignee_id)].filter(Boolean))] as string[];
          if (!pids.length) return [];
          const { data } = await supabase.from("profiles").select("id, name, email").in("id", pids);
          return data ?? [];
        })(),
      ]);
      return { convs, msgs, queues: queues ?? [], people };
    },
  });

  const report = useMemo(() => (data ? buildReport(data.convs, data.msgs) : null), [data]);
  const nameOf = (id: string) => {
    const p = data?.people.find((x: any) => x.id === id) as any;
    return p?.name || p?.email || "Unknown staff";
  };
  const queueRows = useMemo(() => {
    if (!data || !report) return [];
    const m = new Map<string, number>();
    for (const c of data.convs) m.set(c.queue_id ?? "none", (m.get(c.queue_id ?? "none") ?? 0) + 1);
    return [...m.entries()].map(([id, count]) => ({
      name: data.queues.find((q) => q.id === id)?.name ?? "Unassigned", count,
    })).sort((a, b) => b.count - a.count);
  }, [data, report]);

  const { data: canned = [] } = useCannedResponses(true);
  const { data: cannedStats = {} } = useCannedStats();
  const cannedRows = canned
    .map((r) => ({ r, s: cannedStats[r.id] }))
    .filter((x) => (x.s?.uses ?? 0) + (x.s?.auto_sent ?? 0) + (x.s?.trial_total ?? 0) > 0)
    .sort((a, b) => (b.s?.confidence ?? -1) - (a.s?.confidence ?? -1) || (b.s?.uses ?? 0) - (a.s?.uses ?? 0));

  const maxHeat = report ? Math.max(1, ...report.heat.flat()) : 1;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg sm:text-xl font-semibold">Customer Service Hub</h2>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <Button key={r.days} size="sm" variant={days === r.days ? "default" : "outline"} onClick={() => setDays(r.days)}>{r.label}</Button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading customer service figures…</p>}
      {error && <p className="text-sm text-destructive">Couldn't load customer service figures.</p>}
      {report && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <Kpi title="Enquiries (tickets)" value={report.totals.tickets} sub={`${report.totals.whatsapp} WhatsApp · ${report.totals.email} email`} />
            <Kpi title="First response (median)" value={formatMins(report.totals.medianFrt)} sub={`Average ${formatMins(report.totals.avgFrt)}`} />
            <Kpi title="Time to close (median)" value={formatMins(report.totals.medianResolution)} sub={`Average ${formatMins(report.totals.avgResolution)}`} />
            <Kpi title="Answered within target" value={pct(report.totals.slaRate)} />
            <Kpi title="Open / pending / closed" value={`${report.totals.open} / ${report.totals.pending} / ${report.totals.closed}`} />
            <Kpi title="Waiting for first reply" value={report.totals.awaitingFirstReply} />
            <Kpi title="Messages" value={report.totals.inboundMessages} sub={`${report.totals.staffReplies} staff replies · ${report.totals.automated} automated`} />
            <Kpi title="Linked to an order" value={pct(report.totals.linkedRate)} sub={`Reopened after closing ${pct(report.totals.reopenRate)}`} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Enquiry types</CardTitle>
              <p className="text-xs text-muted-foreground">Sorted by the words in the customer's first message, so treat as a guide.</p></CardHeader>
            <CardContent className="space-y-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.topics} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip /><Legend />
                    <Bar dataKey="whatsapp" name="WhatsApp" stackId="a" fill="hsl(var(--primary))" />
                    <Bar dataKey="email" name="Email" stackId="a" fill="hsl(var(--muted-foreground))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Type</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Share</TableHead>
                    <TableHead className="text-right">First reply</TableHead><TableHead className="text-right">Time to close</TableHead><TableHead className="text-right">Still open</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {report.topics.map((t) => (
                      <TableRow key={t.key}>
                        <TableCell>{t.label}</TableCell><TableCell className="text-right">{t.count}</TableCell>
                        <TableCell className="text-right">{pct(t.count / Math.max(1, report.totals.tickets))}</TableCell>
                        <TableCell className="text-right">{formatMins(t.medianFrt)}</TableCell>
                        <TableCell className="text-right">{formatMins(t.medianResolution)}</TableCell>
                        <TableCell className="text-right">{t.open}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">How fast we replied</CardTitle></CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.frtBuckets}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip />
                    <Bar dataKey="count" name="Tickets" fill="hsl(var(--primary))" /></BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Queues</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {queueRows.map((q) => (
                  <div key={q.name} className="flex items-center gap-2 text-sm">
                    <span className="w-28 truncate">{q.name}</span>
                    <div className="h-2 flex-1 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${(q.count / Math.max(1, report.totals.tickets)) * 100}%` }} /></div>
                    <span className="w-8 text-right">{q.count}</span>
                  </div>
                ))}
                <p className="pt-2 text-xs text-muted-foreground">Priority: {report.priorities.map((p) => `${p.priority} ${p.count}`).join(" · ")}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Who responded</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {report.agentRows.length === 0 ? <p className="text-sm text-muted-foreground">No staff replies in this period.</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Staff</TableHead><TableHead className="text-right">Replies</TableHead><TableHead className="text-right">WhatsApp</TableHead>
                    <TableHead className="text-right">Email</TableHead><TableHead className="text-right">First replies</TableHead><TableHead className="text-right">Their first-reply time</TableHead>
                    <TableHead className="text-right">Assigned</TableHead><TableHead className="text-right">Closed</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {report.agentRows.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{nameOf(a.id)}</TableCell><TableCell className="text-right">{a.replies}</TableCell>
                        <TableCell className="text-right">{a.whatsapp}</TableCell><TableCell className="text-right">{a.email}</TableCell>
                        <TableCell className="text-right">{a.firstResponses}</TableCell><TableCell className="text-right">{formatMins(a.medianFrt)}</TableCell>
                        <TableCell className="text-right">{a.assigned}</TableCell><TableCell className="text-right">{a.closed}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">When customers message (UK time)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[560px] space-y-1 text-[10px]">
                <div className="flex gap-px pl-8">{Array.from({ length: 24 }, (_, h) => <div key={h} className="flex-1 text-center text-muted-foreground">{h % 3 === 0 ? h : ""}</div>)}</div>
                {report.heat.map((row, d) => (
                  <div key={d} className="flex items-center gap-px">
                    <span className="w-8 text-muted-foreground">{report.days[d]}</span>
                    {row.map((v, h) => (
                      <div key={h} title={`${report.days[d]} ${h}:00 — ${v}`} className="h-5 flex-1 rounded-sm bg-primary"
                        style={{ opacity: v ? 0.15 + 0.85 * (v / maxHeat) : 0.05 }} />
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Instant response accuracy</CardTitle>
              <p className="text-xs text-muted-foreground">All time. Based on whether staff sent the suggested reply as is, edited it or replaced it.</p></CardHeader>
            <CardContent className="overflow-x-auto">
              {cannedRows.length === 0 ? <p className="text-sm text-muted-foreground">No instant responses used yet — scores build up as staff reply.</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Response</TableHead><TableHead>Confidence</TableHead><TableHead className="text-right">Uses</TableHead>
                    <TableHead className="text-right">As is</TableHead><TableHead className="text-right">Edited</TableHead>
                    <TableHead className="text-right">Rewritten / swapped</TableHead><TableHead className="text-right">Auto-sent</TableHead><TableHead className="text-right">Flagged wrong</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {cannedRows.map(({ r, s: st }) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.title}</TableCell>
                        <TableCell><ConfidenceBadge stats={st} mode={r.auto_send_mode} /></TableCell>
                        <TableCell className="text-right">{st?.uses ?? 0}</TableCell>
                        <TableCell className="text-right">{st?.as_is ?? 0}</TableCell>
                        <TableCell className="text-right">{st?.edited ?? 0}</TableCell>
                        <TableCell className="text-right">{(st?.rewritten ?? 0) + (st?.replaced ?? 0)}</TableCell>
                        <TableCell className="text-right">{st?.auto_sent ?? 0}</TableCell>
                        <TableCell className="text-right">{st?.flagged_wrong ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Message delivery</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-5 gap-2 text-center text-sm">
                {Object.entries(report.delivery).map(([k, v]) => (
                  <div key={k}><p className="text-lg font-semibold">{v}</p><p className="text-xs capitalize text-muted-foreground">{k === "unknown" ? "No status" : k}</p></div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Unresolved tickets by age</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-4 gap-2 text-center text-sm">
                {report.backlog.map((b) => (
                  <div key={b.label}><p className="text-lg font-semibold">{b.count}</p><p className="text-xs text-muted-foreground">{b.label}</p></div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
