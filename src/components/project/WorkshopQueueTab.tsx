import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarPlus, Loader2, PackageOpen, Search, Wrench } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useInternalUsers } from "@/hooks/useTasks";
import { useWorkshopSettings } from "@/lib/labourPricing";
import { fetchWorkshopQueue, type WorkshopQueueItem } from "@/services/workshopQueueService";
import { createTask } from "@/services/tasksService";
import type { Task } from "@/types/task";
import { formatLength } from "@/lib/taskTime";

interface Props {
  /** Tasks already on the plan, used to show what has been added already. */
  tasks: Task[];
  onOpenTask: (id: string) => void;
  onAdded: () => void;
}

const waitBadge = (days: number) => {
  if (days >= 7) return "bg-destructive text-destructive-foreground";
  if (days >= 3) return "bg-amber-500 text-white";
  return "bg-muted text-muted-foreground";
};

const WorkshopQueueTab: React.FC<Props> = ({ tasks, onOpenTask, onAdded }) => {
  const { user } = useAuth();
  const { data: users = [] } = useInternalUsers();
  const { data: settings } = useWorkshopSettings();
  const hourlyRate = settings?.hourly_rate_gbp ?? 75;

  const { data, isLoading } = useQuery({
    queryKey: ["workshop-queue", hourlyRate],
    queryFn: () => fetchWorkshopQueue(hourlyRate),
    staleTime: 30 * 1000,
  });

  const [adding, setAdding] = useState<WorkshopQueueItem | null>(null);
  const [assignee, setAssignee] = useState<string>("");
  const [day, setDay] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);

  // Existing tasks on the plan for the same bike / same job.
  const existing = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of tasks) {
      if (t.status === "done" || t.status === "cancelled") continue;
      const kind = t.category === "inspection" ? "" : "";
      void kind;
      if (t.linked_inspection_id) map.set(`r-${t.linked_inspection_id}`, t);
      if (t.linked_order_id) {
        const key = `i-${t.linked_order_id}`;
        if (!map.has(key)) map.set(key, t);
      }
    }
    return map;
  }, [tasks]);

  const openAdd = (item: WorkshopQueueItem) => {
    setAdding(item);
    setAssignee("");
    setDay(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  };

  const confirmAdd = async () => {
    if (!adding || !user?.id) return;
    if (!assignee) { toast.error("Choose who is doing it"); return; }
    setSaving(true);
    try {
      const label = adding.trackingNumber ? `${adding.bikeLabel} · ${adding.trackingNumber}` : adding.bikeLabel;
      await createTask(
        {
          title: `${adding.kind === "inspect" ? "Inspect" : "Repair"} ${label}`,
          description: adding.note,
          category: "inspection",
          priority: adding.waitingDays >= 7 ? "high" : "normal",
          assignee_id: assignee,
          planned_date: day,
          estimated_minutes: adding.minutes,
          linked_order_id: adding.orderId,
          linked_inspection_id: adding.inspectionId,
        },
        user.id,
      );
      toast.success("Added to the weekly plan");
      setAdding(null);
      onAdded();
    } catch (e: any) {
      toast.error(e?.message || "Could not add it to the plan");
    } finally {
      setSaving(false);
    }
  };

  const Row = ({ item }: { item: WorkshopQueueItem }) => {
    const onPlan = existing.get(item.key);
    return (
      <div className="rounded-md border bg-card p-2.5 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link to={`/orders/${item.orderId}`} className="font-medium text-sm hover:underline">
            {item.bikeLabel}
          </Link>
          {item.trackingNumber && (
            <div className="text-xs text-muted-foreground truncate">{item.trackingNumber}</div>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${waitBadge(item.waitingDays)}`}>
              {item.kind === "inspect"
                ? item.waitingDays === 1
                  ? "Collected yesterday"
                  : item.waitingDays === 0
                    ? "Collected today"
                    : `Collected ${item.waitingDays} days ago`
                : item.waitingDays === 0
                  ? "Parts in today"
                  : `Waiting ${item.waitingDays} day${item.waitingDays === 1 ? "" : "s"}`}
            </span>
            <Badge variant="outline" className="text-[10px]">{formatLength(item.minutes)}</Badge>
            {item.note && <span className="text-[10px] text-muted-foreground">{item.note}</span>}
          </div>
        </div>
        {onPlan ? (
          <Button size="sm" variant="ghost" onClick={() => onOpenTask(onPlan.id)}>
            On the plan
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => openAdd(item)}>
            <CalendarPlus className="h-4 w-4 mr-1" /> Add to calendar
          </Button>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Loading workshop queue…</p>;
  }

  const toInspect = data?.toInspect ?? [];
  const repairsReady = data?.repairsReady ?? [];

  return (
    <div className="space-y-4 min-w-0">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" /> Bikes to inspect ({toInspect.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Collected and still waiting — most recent collections first
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {toInspect.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nothing waiting to be inspected.</p>
            ) : (
              toInspect.map((item) => <Row key={item.key} item={item} />)
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Repairs ready to start ({repairsReady.length})
            </CardTitle>
            <CardDescription className="text-xs flex items-center gap-1">
              <PackageOpen className="h-3 w-3" /> Approved repairs with the parts in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {repairsReady.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No repairs ready right now.</p>
            ) : (
              repairsReady.map((item) => <Row key={item.key} item={item} />)
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to the plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {adding?.bikeLabel}
              {adding ? ` · ${formatLength(adding.minutes)}` : ""}
            </div>
            <div>
              <Label>Who is doing it?</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger><SelectValue placeholder="Choose a mechanic" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Which day?</Label>
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(null)}>Cancel</Button>
            <Button onClick={confirmAdd} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkshopQueueTab;
