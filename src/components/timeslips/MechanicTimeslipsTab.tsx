import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { MapPin, Check, X, Pencil, Trash2 } from 'lucide-react';
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
  if (!path) return <span className="text-caption text-muted-foreground">—</span>;
  return (
    <a href={url ?? '#'} target="_blank" rel="noreferrer" className="inline-block">
      {url ? (
        <img src={url} alt="clock" className="w-16 h-16 object-cover rounded border" />
      ) : (
        <div className="w-16 h-16 bg-muted rounded animate-pulse" />
      )}
    </a>
  );
}

function GpsLink({ lat, lng }: { lat: number | null; lng: number | null }) {
  if (lat == null || lng == null) return <span className="text-caption text-muted-foreground">no GPS</span>;
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center text-caption text-primary hover:underline"
    >
      <MapPin className="h-3 w-3 mr-1" /> map
    </a>
  );
}

interface EditState {
  slip: MechanicTimeslip;
  hourly_rate: number;
  lunch_hours: number;
  admin_notes: string;
  status: MechanicTimeslip['status'];
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
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
        <Card className="ml-auto">
          <CardContent className="p-3 text-right">
            <div className="text-caption text-muted-foreground">Total pay shown</div>
            <div className="text-h4 font-bold text-green-600">£{total.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : slips && slips.length > 0 ? (
        <div className="grid gap-3">
          {slips.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex flex-wrap gap-4 items-center">
                <div className="min-w-[160px]">
                  <div className="font-semibold">{s.driver?.name || s.driver?.email || '—'}</div>
                  <div className="text-caption text-muted-foreground">{format(new Date(s.date), 'EEE d MMM yyyy')}</div>
                  <div className="text-caption mt-1 inline-block px-2 py-0.5 rounded bg-muted capitalize">{s.status}</div>
                </div>
                <div className="text-center">
                  <div className="text-caption text-muted-foreground mb-1">Clock in</div>
                  <PhotoCell path={s.clock_in_photo_url} />
                  <div className="text-caption mt-1">{format(new Date(s.clock_in_at), 'HH:mm')}</div>
                  <GpsLink lat={s.clock_in_lat} lng={s.clock_in_lng} />
                </div>
                <div className="text-center">
                  <div className="text-caption text-muted-foreground mb-1">Clock out</div>
                  <PhotoCell path={s.clock_out_photo_url} />
                  <div className="text-caption mt-1">{s.clock_out_at ? format(new Date(s.clock_out_at), 'HH:mm') : '—'}</div>
                  <GpsLink lat={s.clock_out_lat} lng={s.clock_out_lng} />
                </div>
                <div className="min-w-[120px] text-right">
                  <div className="text-caption text-muted-foreground">Hours</div>
                  <div className="font-semibold">{Number(s.total_hours || 0).toFixed(2)}h</div>
                  <div className="text-caption text-muted-foreground">Lunch {Number(s.lunch_hours).toFixed(2)}h · £{Number(s.hourly_rate).toFixed(2)}/hr</div>
                </div>
                <div className="min-w-[100px] text-right">
                  <div className="text-caption text-muted-foreground">Pay</div>
                  <div className="text-body-lg font-bold text-green-600">£{Number(s.total_pay || 0).toFixed(2)}</div>
                </div>
                <div className="ml-auto flex flex-wrap gap-2">
                  {s.status !== 'approved' && s.clock_out_at && (
                    <Button size="sm" onClick={() => approve(s.id)}>
                      <Check className="h-4 w-4 mr-1" />Approve
                    </Button>
                  )}
                  {s.status !== 'rejected' && (
                    <Button size="sm" variant="outline" onClick={() => reject(s.id)}>
                      <X className="h-4 w-4 mr-1" />Reject
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEditing({
                    slip: s,
                    hourly_rate: Number(s.hourly_rate),
                    lunch_hours: Number(s.lunch_hours),
                    admin_notes: s.admin_notes || '',
                    status: s.status,
                  })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeletingId(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
              {s.admin_notes && (
                <div className="px-4 pb-3 text-caption text-muted-foreground">Notes: {s.admin_notes}</div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No mechanic timeslips.</CardContent></Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit mechanic timeslip</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => editing && updateMut.mutate({
              id: editing.slip.id,
              updates: {
                hourly_rate: editing.hourly_rate,
                lunch_hours: editing.lunch_hours,
                admin_notes: editing.admin_notes || null,
                status: editing.status,
              },
            })} disabled={updateMut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete timeslip?</DialogTitle></DialogHeader>
          <p className="text-small text-muted-foreground">This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletingId && deleteMut.mutate(deletingId)} disabled={deleteMut.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MechanicTimeslipsTab;
