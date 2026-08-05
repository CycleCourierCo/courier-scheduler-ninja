import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { MapPin, Check, X, Pencil, Trash2, LogIn, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import {
  listAllMechanicTimeslips,
  updateMechanicTimeslip,
  deleteMechanicTimeslip,
  getSignedPhotoUrl,
  MechanicTimeslip,
} from '@/services/mechanicTimeslipService';

function PhotoCell({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getSignedPhotoUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);
  if (!path) return <div className="w-14 h-14 rounded border border-dashed flex items-center justify-center text-xs text-muted-foreground">—</div>;
  return (
    <a href={url ?? '#'} target="_blank" rel="noreferrer" className="inline-block shrink-0">
      {url ? (
        <img src={url} alt="clock photo" className="w-14 h-14 object-cover rounded border" />
      ) : (
        <div className="w-14 h-14 bg-muted rounded animate-pulse" />
      )}
    </a>
  );
}

function GpsLink({ lat, lng }: { lat: number | null; lng: number | null }) {
  if (lat == null || lng == null) return <span className="text-xs text-muted-foreground">no GPS</span>;
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center text-xs text-primary hover:underline"
    >
      <MapPin className="h-3 w-3 mr-1" /> map
    </a>
  );
}

function ClockBlock({
  kind,
  at,
  path,
  lat,
  lng,
}: {
  kind: 'in' | 'out';
  at: string | null;
  path: string | null;
  lat: number | null;
  lng: number | null;
}) {
  const Icon = kind === 'in' ? LogIn : LogOut;
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2 min-w-0">
      <PhotoCell path={path} />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Icon className="h-3 w-3" /> Clock {kind}
        </div>
        <div className="text-sm font-semibold tabular-nums">{at ? format(new Date(at), 'HH:mm') : '—'}</div>
        <GpsLink lat={lat} lng={lng} />
      </div>
    </div>
  );
}

function statusVariant(status: MechanicTimeslip['status']) {
  if (status === 'approved') return 'default' as const;
  if (status === 'rejected') return 'destructive' as const;
  return 'secondary' as const;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

interface EditState {
  slip: MechanicTimeslip;
  hourly_rate: number;
  lunch_hours: number;
  admin_notes: string;
  status: MechanicTimeslip['status'];
  clock_in_at: string;
  clock_out_at: string;
}

const MechanicTimeslipsTab: React.FC = () => {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editing, setEditing] = useState<EditState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: slips, isLoading } = useQuery({
    queryKey: ['mechanic-timeslips-admin', statusFilter],
    queryFn: () => listAllMechanicTimeslips({ status: statusFilter }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => updateMechanicTimeslip(id, updates),
    onSuccess: () => {
      toast.success('Updated');
      qc.invalidateQueries({ queryKey: ['mechanic-timeslips-admin'] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || 'Update failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteMechanicTimeslip(id),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['mechanic-timeslips-admin'] });
      setDeletingId(null);
    },
    onError: (e: any) => toast.error(e.message || 'Delete failed'),
  });

  const approve = (id: string) => updateMut.mutate({ id, updates: { status: 'approved' } });
  const reject = (id: string) => updateMut.mutate({ id, updates: { status: 'rejected' } });

  const total = (slips || []).reduce((s, r) => s + Number(r.total_pay || 0), 0);

  const saveEdit = () => {
    if (!editing) return;
    const clockIn = fromLocalInput(editing.clock_in_at);
    if (!clockIn) {
      toast.error('Clock in time is required');
      return;
    }
    const clockOut = fromLocalInput(editing.clock_out_at);
    if (clockOut && new Date(clockOut) <= new Date(clockIn)) {
      toast.error('Clock out must be after clock in');
      return;
    }
    updateMut.mutate({
      id: editing.slip.id,
      updates: {
        hourly_rate: editing.hourly_rate,
        lunch_hours: editing.lunch_hours,
        admin_notes: editing.admin_notes || null,
        status: editing.status,
        clock_in_at: clockIn,
        clock_out_at: clockOut,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="w-full sm:w-40">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed (pending)</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Card className="w-full sm:w-auto sm:ml-auto">
          <CardContent className="p-3 flex items-center justify-between gap-4 sm:block sm:text-right">
            <div className="text-xs text-muted-foreground">Total pay shown</div>
            <div className="text-xl font-bold text-green-600 tabular-nums">£{total.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : slips && slips.length > 0 ? (
        <div className="grid gap-3">
          {slips.map((s) => (
            <Card key={s.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold break-words">{s.driver?.name || s.driver?.email || '—'}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(s.date), 'EEE d MMM yyyy')}</div>
                  </div>
                  <Badge variant={statusVariant(s.status)} className="capitalize shrink-0">{s.status}</Badge>
                </div>

                {/* Clock blocks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <ClockBlock kind="in" at={s.clock_in_at} path={s.clock_in_photo_url} lat={s.clock_in_lat} lng={s.clock_in_lng} />
                  <ClockBlock kind="out" at={s.clock_out_at} path={s.clock_out_photo_url} lat={s.clock_out_lat} lng={s.clock_out_lng} />
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg border p-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Hours</div>
                    <div className="font-semibold tabular-nums">{Number(s.total_hours || 0).toFixed(2)}h</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Lunch</div>
                    <div className="font-semibold tabular-nums">{Number(s.lunch_hours || 0).toFixed(2)}h</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Rate</div>
                    <div className="font-semibold tabular-nums">£{Number(s.hourly_rate || 0).toFixed(2)}/hr</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Pay</div>
                    <div className="font-bold text-green-600 tabular-nums">£{Number(s.total_pay || 0).toFixed(2)}</div>
                  </div>
                </div>

                {s.admin_notes && (
                  <div className="text-xs text-muted-foreground break-words">Notes: {s.admin_notes}</div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-1 border-t pt-3">
                  {s.status !== 'approved' && s.clock_out_at && (
                    <Button size="sm" className="flex-1 sm:flex-none" onClick={() => approve(s.id)} disabled={updateMut.isPending}>
                      <Check className="h-4 w-4 mr-1" />Approve
                    </Button>
                  )}
                  {s.status !== 'rejected' && (
                    <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => reject(s.id)} disabled={updateMut.isPending}>
                      <X className="h-4 w-4 mr-1" />Reject
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setEditing({
                    slip: s,
                    hourly_rate: Number(s.hourly_rate),
                    lunch_hours: Number(s.lunch_hours),
                    admin_notes: s.admin_notes || '',
                    status: s.status,
                    clock_in_at: toLocalInput(s.clock_in_at),
                    clock_out_at: toLocalInput(s.clock_out_at),
                  })}>
                    <Pencil className="h-4 w-4 mr-1" />Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeletingId(s.id)} aria-label="Delete timeslip">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No mechanic timeslips.</CardContent></Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit mechanic timeslip</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Clock in</Label>
                  <Input type="datetime-local" value={editing.clock_in_at}
                    onChange={(e) => setEditing({ ...editing, clock_in_at: e.target.value })} />
                </div>
                <div>
                  <Label>Clock out</Label>
                  <Input type="datetime-local" value={editing.clock_out_at}
                    onChange={(e) => setEditing({ ...editing, clock_out_at: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Clear to reopen the shift.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hourly rate (£)</Label>
                  <Input type="number" step="0.25" value={editing.hourly_rate}
                    onChange={(e) => setEditing({ ...editing, hourly_rate: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Lunch hours</Label>
                  <Input type="number" step="0.25" value={editing.lunch_hours}
                    onChange={(e) => setEditing({ ...editing, lunch_hours: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Admin notes</Label>
                <Textarea rows={3} value={editing.admin_notes}
                  onChange={(e) => setEditing({ ...editing, admin_notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateMut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete timeslip?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone.</p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletingId && deleteMut.mutate(deletingId)} disabled={deleteMut.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MechanicTimeslipsTab;
