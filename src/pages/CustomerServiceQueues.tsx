import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCsQueues, useCsQueueMembers, useCsQueueSlas, useCsStaff } from "@/hooks/useCsQueues";
import {
  addQueueMember, createQueue, removeQueueMember, setDefaultQueue,
  setQueueMemberActive, updateQueue, upsertQueueSla,
} from "@/services/customerServiceQueueService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CannedResponseManager from "@/components/inbox/CannedResponseManager";
import { CS_PRIORITIES, type CsPriority } from "@/types/customerService";
import { formatTargetMinutes } from "@/lib/csTickets";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Users } from "lucide-react";

const CustomerServiceQueues: React.FC = () => {
  const qc = useQueryClient();
  const { data: queues = [], isLoading } = useCsQueues();
  const { data: members = [] } = useCsQueueMembers();
  const { data: slas = [] } = useCsQueueSlas();
  const { data: staff = [] } = useCsStaff();

  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const staffNames = useMemo(
    () => Object.fromEntries(staff.map(s => [s.id, s.name || s.email || 'Staff'])),
    [staff],
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['cs-queues'] });
    qc.invalidateQueries({ queryKey: ['cs-queue-members'] });
    qc.invalidateQueries({ queryKey: ['cs-queue-slas'] });
    qc.invalidateQueries({ queryKey: ['cs-queue-counts'] });
  };

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-3 md:px-4 py-4 space-y-4">
        <div className="flex items-center flex-wrap gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/inbox"><ArrowLeft className="h-4 w-4 mr-1" />Back to inbox</Link>
          </Button>
          <h1 className="text-xl font-semibold">Inbox settings</h1>
        </div>

        <Tabs defaultValue="queues" className="space-y-4">
          <TabsList>
            <TabsTrigger value="queues">Queues</TabsTrigger>
            <TabsTrigger value="responses">Instant responses</TabsTrigger>
          </TabsList>

          <TabsContent value="responses">
            <CannedResponseManager />
          </TabsContent>

          <TabsContent value="queues" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add a queue</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Queue name, e.g. Accounts"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="sm:max-w-xs"
            />
            <Button
              disabled={busy || !newName.trim()}
              onClick={() => run(async () => {
                await createQueue(newName);
                setNewName('');
              }, 'Queue added')}
            >
              <Plus className="h-4 w-4 mr-1" />Add queue
            </Button>
          </CardContent>
        </Card>

        {isLoading && <p className="text-sm text-muted-foreground">Loading queues…</p>}

        {queues.map((queue) => {
          const queueMembers = members.filter(m => m.queue_id === queue.id);
          const queueSlas = slas.filter(s => s.queue_id === queue.id);
          const available = staff.filter(s => !queueMembers.some(m => m.user_id === s.id));

          return (
            <Card key={queue.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center flex-wrap gap-2">
                  <CardTitle className="text-base">{queue.name}</CardTitle>
                  {queue.is_default && <Badge variant="secondary">Default</Badge>}
                  {!queue.is_active && <Badge variant="outline">Hidden</Badge>}
                  <div className="ml-auto flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      Active
                      <Switch
                        checked={queue.is_active}
                        disabled={busy}
                        onCheckedChange={(v) => run(
                          () => updateQueue(queue.id, { is_active: v }),
                          v ? 'Queue shown in the inbox' : 'Queue hidden',
                        )}
                      />
                    </label>
                    {!queue.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => run(() => setDefaultQueue(queue.id), 'Default queue updated')}
                      >
                        Make default
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Users className="h-4 w-4" />Who takes these tickets
                  </div>
                  <div className="space-y-2">
                    {queueMembers.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No one added yet — tickets stay unassigned until someone picks them up.
                      </p>
                    )}
                    {queueMembers.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate">{staffNames[m.user_id] || 'Staff member'}</span>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          Taking tickets
                          <Switch
                            checked={m.is_active}
                            disabled={busy}
                            onCheckedChange={(v) => run(
                              () => setQueueMemberActive(m.id, v),
                              v ? 'Now receiving tickets' : 'Paused from new tickets',
                            )}
                          />
                        </label>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={busy}
                          onClick={() => run(() => removeQueueMember(m.id), 'Removed from queue')}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    {available.length > 0 && (
                      <Select
                        value=""
                        onValueChange={(userId) => run(
                          () => addQueueMember(queue.id, userId),
                          'Added to queue',
                        )}
                      >
                        <SelectTrigger className="h-8 text-xs sm:max-w-xs">
                          <SelectValue placeholder="Add someone to this queue" />
                        </SelectTrigger>
                        <SelectContent>
                          {available.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Reply time targets</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {CS_PRIORITIES.map((p: CsPriority) => {
                      const sla = queueSlas.find(s => s.priority === p);
                      return (
                        <div key={p} className="border rounded-md p-2">
                          <div className="text-xs capitalize text-muted-foreground mb-1">{p}</div>
                          <Input
                            type="number"
                            min={5}
                            step={5}
                            className="h-8 text-sm"
                            defaultValue={sla?.target_minutes ?? ''}
                            placeholder="Minutes"
                            onBlur={(e) => {
                              const mins = Number(e.target.value);
                              if (!Number.isFinite(mins) || mins < 5) return;
                              if (mins === sla?.target_minutes) return;
                              run(() => upsertQueueSla(queue.id, p, mins), 'Reply time updated');
                            }}
                          />
                          <div className="text-[11px] text-muted-foreground mt-1">
                            {sla ? formatTargetMinutes(sla.target_minutes) : 'Not set'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default CustomerServiceQueues;
