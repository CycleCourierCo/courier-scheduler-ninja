import React, { useMemo, useState } from "react";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Plus,
  Printer,
  Trash2,
  Truck,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notify } from "@/lib/notify";
import { useBikeSpaces, formatSpaces } from "@/lib/bikeSpaces";
import { useSites, findSite, DEFAULT_SITE_CODE, SCOTLAND_SITE_CODE } from "@/hooks/useSites";
import {
  addItemsToRun,
  advanceTrunkRun,
  buildTrunkSignals,
  createTrunkRun,
  deleteTrunkRun,
  listTrunkCandidates,
  listTrunkRunItems,
  listTrunkRuns,
  removeRunItem,
  trunkRecommendation,
  type TrunkCandidate,
  type TrunkDirection,
  type TrunkRun,
} from "@/services/trunkRunService";

const STATUS_STYLES: Record<string, string> = {
  planned: "bg-amber-500",
  loaded: "bg-blue-500",
  departed: "bg-indigo-500",
  arrived: "bg-green-600",
  cancelled: "bg-red-500",
};

const directionLabel = (d: TrunkDirection) =>
  d === "northbound" ? "Depot → Scotland" : "Scotland → Depot";

const TrunkRunsPage: React.FC = () => {
  const qc = useQueryClient();
  const { data: sites = [] } = useSites();
  const { data: spaceData } = useBikeSpaces();
  const spaceMap = spaceData?.spaceMap ?? {};
  const capacity = spaceData?.capacity ?? 10;

  const [direction, setDirection] = useState<TrunkDirection>("northbound");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [runDate, setRunDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [driverMode, setDriverMode] = useState("depot_trunker");
  const [runCapacity, setRunCapacity] = useState(String(capacity));
  const [notes, setNotes] = useState("");

  const runsQuery = useQuery({ queryKey: ["trunk_runs"], queryFn: () => listTrunkRuns() });
  const runs = runsQuery.data ?? [];

  const itemsQuery = useQuery({
    queryKey: ["trunk_run_items", runs.map((r) => r.id).join(",")],
    enabled: runs.length > 0,
    queryFn: () => listTrunkRunItems(runs.map((r) => r.id)),
  });

  const candidatesQuery = useQuery({
    queryKey: ["trunk_candidates", Object.keys(spaceMap).length],
    enabled: !!spaceData,
    queryFn: () => listTrunkCandidates(spaceMap),
  });
  const candidates = candidatesQuery.data ?? [];

  const signals = useMemo(
    () => buildTrunkSignals(candidates, runs, capacity),
    [candidates, runs, capacity],
  );
  const recommendation = useMemo(() => trunkRecommendation(signals), [signals]);

  const directionCandidates = candidates.filter((c) => c.direction === direction);
  const selectedCandidates = directionCandidates.filter((c) => selected[c.id]);
  const selectedSpaces =
    Math.round(selectedCandidates.reduce((t, c) => t + c.spaces, 0) * 100) / 100;
  const capacityNumber = Number(runCapacity) > 0 ? Number(runCapacity) : capacity;
  const overloaded = selectedSpaces > capacityNumber;

  const originSite = findSite(sites, direction === "northbound" ? DEFAULT_SITE_CODE : SCOTLAND_SITE_CODE);
  const destinationSite = findSite(sites, direction === "northbound" ? SCOTLAND_SITE_CODE : DEFAULT_SITE_CODE);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["trunk_runs"] });
    qc.invalidateQueries({ queryKey: ["trunk_run_items"] });
    qc.invalidateQueries({ queryKey: ["trunk_candidates"] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const run = await createTrunkRun({
        run_date: runDate,
        direction,
        origin_site_id: originSite?.id ?? null,
        destination_site_id: destinationSite?.id ?? null,
        driver_id: null,
        vehicle_id: null,
        driver_mode: driverMode as any,
        capacity_spaces: capacityNumber,
        notes: notes || null,
      });
      await addItemsToRun(run.id, selectedCandidates);
      return run;
    },
    onSuccess: () => {
      toast.success("Trunk run created");
      setCreateOpen(false);
      setSelected({});
      setNotes("");
      invalidate();
    },
    onError: (err: any) => {
      Sentry.captureException(err);
      toast.error(err?.message || "Couldn't create the trunk run. Try again in a moment.");
    },
  });

  const advanceMutation = useMutation({
    mutationFn: ({ run, stage }: { run: TrunkRun; stage: "loaded" | "departed" | "arrived" }) =>
      advanceTrunkRun(run, stage),
    onSuccess: () => {
      toast.success("Run updated");
      invalidate();
    },
    onError: (err: any) => {
      Sentry.captureException(err);
      toast.error("Couldn't update the run. Refresh and try again.");
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (id: string) => removeRunItem(id),
    onSuccess: invalidate,
  });

  const handleDeleteRun = (run: TrunkRun) => {
    notify.confirm({
      title: `Delete run on ${format(new Date(run.run_date), "d MMM yyyy")}?`,
      description: "The bikes go back into the waiting list.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteTrunkRun(run.id);
          toast.success("Run deleted");
          invalidate();
        } catch (err) {
          Sentry.captureException(err);
          toast.error("Couldn't delete this run.");
        }
      },
    });
  };

  const printManifest = (run: TrunkRun, items: any[]) => {
    const rows = items
      .map((item) => {
        const c = candidateOrPlaceholder(item, candidates);
        return `<tr><td>${c.tracking_number ?? "—"}</td><td>${c.bike_summary}</td><td>${item.origin_bay ?? "—"}</td><td>${formatSpaces(Number(item.spaces))}</td><td>${c.destination}</td></tr>`;
      })
      .join("");
    const html = `<!doctype html><html><head><title>Trunk manifest</title>
      <style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px;text-align:left}h1{font-size:18px}</style></head>
      <body><h1>Trunk manifest — ${directionLabel(run.direction)}</h1>
      <p>${format(new Date(run.run_date), "EEEE d MMMM yyyy")} · ${items.length} bikes · ${formatSpaces(items.reduce((t, i) => t + Number(i.spaces), 0))} van spaces</p>
      <table><thead><tr><th>Tracking</th><th>Bike</th><th>Bay</th><th>Spaces</th><th>Destination</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`;
    const win = window.open("", "_blank");
    if (!win) return toast.error("Allow pop-ups to print the manifest.");
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const itemsForRun = (runId: string) =>
    (itemsQuery.data ?? []).filter((i) => i.run_id === runId);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-6 w-6" />
              Trunk Runs
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Decide how many bikes move between the Birmingham and Scotland depots, and when.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} disabled={selectedCandidates.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            New run ({selectedCandidates.length})
          </Button>
        </div>

        {/* Signals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowUp className="h-3 w-3" /> Waiting northbound
              </div>
              <div className="text-2xl font-bold">{signals.northboundCount}</div>
              <div className="text-xs text-muted-foreground">
                {formatSpaces(signals.northboundSpaces)} / {capacity} spaces
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowDown className="h-3 w-3" /> Waiting southbound
              </div>
              <div className="text-2xl font-bold">{signals.southboundCount}</div>
              <div className="text-xs text-muted-foreground">
                {formatSpaces(signals.southboundSpaces)} / {capacity} spaces
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> Longest wait
              </div>
              <div className="text-2xl font-bold">
                {Math.max(signals.northboundOldestDays, signals.southboundOldestDays)}d
              </div>
              <div className="text-xs text-muted-foreground">oldest bike waiting</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground">Next planned run</div>
              <div className="text-lg font-bold">
                {signals.nextRunDate
                  ? format(new Date(signals.nextRunDate), "d MMM")
                  : "None"}
              </div>
              <div className="text-xs text-muted-foreground">
                {recommendation ? "Run suggested" : "No action needed"}
              </div>
            </CardContent>
          </Card>
        </div>

        {recommendation && (
          <Card className="mb-6 border-amber-500/50 bg-amber-500/5">
            <CardContent className="py-3 text-sm">
              <span className="font-medium">Suggestion: </span>
              {recommendation.reason}
            </CardContent>
          </Card>
        )}

        <Tabs value={direction} onValueChange={(v) => { setDirection(v as TrunkDirection); setSelected({}); }}>
          <TabsList className="mb-4">
            <TabsTrigger value="northbound">Northbound</TabsTrigger>
            <TabsTrigger value="southbound">Southbound</TabsTrigger>
          </TabsList>

          <TabsContent value={direction} className="mt-0">
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex flex-wrap items-center justify-between gap-2">
                  <span>Bikes waiting — {directionLabel(direction)}</span>
                  <span className={overloaded ? "text-destructive text-sm" : "text-sm text-muted-foreground"}>
                    {formatSpaces(selectedSpaces)} / {capacityNumber} spaces selected
                  </span>
                </CardTitle>
                <Progress
                  value={Math.min(100, (selectedSpaces / capacityNumber) * 100)}
                  className={overloaded ? "[&>div]:bg-destructive" : ""}
                />
              </CardHeader>
              <CardContent className="space-y-2">
                {candidatesQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground py-4">Loading waiting bikes…</p>
                ) : directionCandidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    Nothing waiting in this direction.
                  </p>
                ) : (
                  directionCandidates.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start gap-3 rounded-md border p-3 text-sm"
                    >
                      <Checkbox
                        checked={!!selected[c.id]}
                        onCheckedChange={(v) =>
                          setSelected((prev) => ({ ...prev, [c.id]: !!v }))
                        }
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium break-all">{c.tracking_number ?? "No tracking"}</span>
                          <Badge variant="outline">{formatSpaces(c.spaces)} spaces</Badge>
                          {c.storage_labels.length > 0 && (
                            <Badge variant="secondary" className="font-mono">
                              {c.storage_labels.join(", ")}
                            </Badge>
                          )}
                          {c.waiting_days >= 5 && (
                            <Badge className="bg-red-500 text-white">
                              Waiting {c.waiting_days}d
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground break-words">
                          {c.bike_summary} · {c.sender_name} → {c.receiver_name} ({c.destination})
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Runs */}
        <h2 className="text-lg font-semibold mb-3">Runs</h2>
        {runsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading runs…</p>
        ) : runs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No trunk runs yet. Pick the bikes waiting above and create one.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => {
              const items = itemsForRun(run.id);
              const spaces = items.reduce((t, i) => t + Number(i.spaces), 0);
              return (
                <Card key={run.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex flex-wrap items-center gap-2">
                      <Badge className={`${STATUS_STYLES[run.status] ?? "bg-gray-500"} text-white`}>
                        {run.status}
                      </Badge>
                      <span>{format(new Date(run.run_date), "EEE d MMM yyyy")}</span>
                      <span className="text-muted-foreground text-sm font-normal">
                        {directionLabel(run.direction)} ·{" "}
                        {run.driver_mode === "scotland_driver"
                          ? "Scotland driver handover"
                          : "Depot trunker"}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      {items.length} bikes · {formatSpaces(spaces)} / {formatSpaces(Number(run.capacity_spaces))} van spaces
                      {run.notes ? ` · ${run.notes}` : ""}
                    </div>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const c = candidateOrPlaceholder(item, candidates);
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs"
                          >
                            <span className="min-w-0 break-all">
                              {c.tracking_number ?? item.order_id?.slice(0, 8)} · {c.bike_summary}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-muted-foreground">
                                {formatSpaces(Number(item.spaces))} sp
                              </span>
                              {run.status === "planned" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => removeItemMutation.mutate(item.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {run.status === "planned" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => advanceMutation.mutate({ run, stage: "loaded" })}
                          >
                            Mark loaded
                          </Button>
                          {selectedCandidates.length > 0 && run.direction === direction && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                await addItemsToRun(run.id, selectedCandidates);
                                setSelected({});
                                invalidate();
                                toast.success("Bikes added to run");
                              }}
                            >
                              Add selected ({selectedCandidates.length})
                            </Button>
                          )}
                        </>
                      )}
                      {run.status === "loaded" && (
                        <Button size="sm" onClick={() => advanceMutation.mutate({ run, stage: "departed" })}>
                          Mark departed
                        </Button>
                      )}
                      {run.status === "departed" && (
                        <Button size="sm" onClick={() => advanceMutation.mutate({ run, stage: "arrived" })}>
                          Mark arrived
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => printManifest(run, items)}>
                        <Printer className="mr-2 h-4 w-4" /> Manifest
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteRun(run)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New trunk run</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {directionLabel(direction)} · {selectedCandidates.length} bikes ·{" "}
              {formatSpaces(selectedSpaces)} spaces
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={runDate} onChange={(e) => setRunDate(e.target.value)} />
            </div>
            <div>
              <Label>Driver setup</Label>
              <Select value={driverMode} onValueChange={setDriverMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="depot_trunker">Depot driver goes up and back</SelectItem>
                  <SelectItem value="scotland_driver">Handover to Scotland driver</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Van capacity (spaces)</Label>
              <Input
                type="number"
                min={1}
                value={runCapacity}
                onChange={(e) => setRunCapacity(e.target.value)}
              />
              {overloaded && (
                <p className="text-xs text-destructive mt-1">
                  Selected load exceeds this capacity.
                </p>
              )}
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

function candidateOrPlaceholder(item: any, candidates: TrunkCandidate[]) {
  const match = candidates.find((c) => c.id === item.order_id);
  return (
    match ?? {
      tracking_number: null as string | null,
      bike_summary: "Bike",
      destination: "—",
    }
  );
}

export default TrunkRunsPage;
