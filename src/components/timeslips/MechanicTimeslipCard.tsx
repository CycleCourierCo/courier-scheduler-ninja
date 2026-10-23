import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { MapPin, Check, X, Pencil, Trash2, LogIn, LogOut, Wrench, Layers } from 'lucide-react';
import { MechanicTimeslip, getSignedPhotoUrl } from '@/services/mechanicTimeslipService';
import { formatMinutes, DayWork } from '@/services/mechanicWorkService';

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

/** Overall status for a day's sessions: open wins, then mixed/closed, then the shared status. */
function overallStatus(slips: MechanicTimeslip[]): MechanicTimeslip['status'] {
  if (slips.some((s) => s.status === 'open')) return 'open';
  if (slips.some((s) => s.status === 'closed')) return 'closed';
  if (slips.every((s) => s.status === 'approved')) return 'approved';
  if (slips.every((s) => s.status === 'rejected')) return 'rejected';
  return 'closed';
}

interface MechanicTimeslipCardProps {
  /** All of the mechanic's sessions for one day, ordered by clock-in time. */
  slips: MechanicTimeslip[];
  work?: DayWork;
  actionPending?: boolean;
  /** Approve/reject every session on the card in one go. */
  onApprove: (ids: string[]) => void;
  onReject: (ids: string[]) => void;
  /** Edit/delete a single session. */
  onEdit: (slip: MechanicTimeslip) => void;
  onDelete: (id: string) => void;
}

const MechanicTimeslipCard: React.FC<MechanicTimeslipCardProps> = ({
  slips,
  work,
  actionPending,
  onApprove,
  onReject,
  onEdit,
  onDelete,
}) => {
  const first = slips[0];
  const multi = slips.length > 1;
  const status = overallStatus(slips);
  const ids = slips.map((s) => s.id);

  const totalHours = slips.reduce((sum, s) => sum + Number(s.total_hours || 0), 0);
  const totalLunch = slips.reduce((sum, s) => sum + Number(s.lunch_hours || 0), 0);
  const totalPay = slips.reduce((sum, s) => sum + Number(s.total_pay || 0), 0);
  const rate = Number(first.hourly_rate || 0);

  const notes = slips.map((s) => s.admin_notes).filter(Boolean) as string[];
  const explanations = slips.map((s) => s.clock_out_explanation).filter(Boolean) as string[];

  const allClosedOut = slips.every((s) => s.clock_out_at);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold break-words">{first.driver?.name || first.driver?.email || '—'}</div>
            <div className="text-xs text-muted-foreground">{format(new Date(first.date), 'EEE d MMM yyyy')}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <Badge variant="outline" className="gap-1">
              <Wrench className="h-3 w-3" /> Mechanic
            </Badge>
            {multi && (
              <Badge variant="outline" className="gap-1">
                <Layers className="h-3 w-3" /> {slips.length} sessions
              </Badge>
            )}
            <Badge variant={statusVariant(status)} className="capitalize">{status}</Badge>
          </div>
        </div>

        {/* Sessions */}
        <div className="space-y-2">
          {slips.map((s, i) => (
            <div key={s.id} className="space-y-2">
              {multi && (
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-muted-foreground">Session {i + 1}</div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onEdit(s)} aria-label="Edit session">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onDelete(s.id)} aria-label="Delete session">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ClockBlock kind="in" at={s.clock_in_at} path={s.clock_in_photo_url} lat={s.clock_in_lat} lng={s.clock_in_lng} />
                <ClockBlock kind="out" at={s.clock_out_at} path={s.clock_out_photo_url} lat={s.clock_out_lat} lng={s.clock_out_lng} />
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg border p-2 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Hours</div>
            <div className="font-semibold tabular-nums">{totalHours.toFixed(2)}h</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Lunch</div>
            <div className="font-semibold tabular-nums">{totalLunch.toFixed(2)}h</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Rate</div>
            <div className="font-semibold tabular-nums">£{rate.toFixed(2)}/hr</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Pay</div>
            <div className="font-bold text-green-600 tabular-nums">£{totalPay.toFixed(2)}</div>
          </div>
        </div>

        {notes.length > 0 && (
          <div className="text-xs text-muted-foreground break-words">Notes: {notes.join(' · ')}</div>
        )}

        {explanations.map((ex, i) => (
          <div key={i} className="text-xs rounded-md border bg-status-waiting/10 dark:bg-status-waiting/20 p-2 break-words">
            <span className="font-medium">Clock-out explanation:</span> {ex}
          </div>
        ))}

        {work && work.items.length > 0 && (
          <div className="text-xs rounded-md border bg-muted/30 p-2 space-y-0.5">
            <div className="font-medium">Work done — {formatMinutes(work.totalMinutes)} recorded</div>
            {work.items.map((item, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate">
                  {format(new Date(item.at), 'HH:mm')} — {item.label}
                  {item.detail ? ` (${item.detail})` : ''}
                </span>
                <span className="shrink-0 text-muted-foreground">{formatMinutes(item.minutes)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {status !== 'approved' && allClosedOut && (
            <Button size="sm" className="flex-1 sm:flex-none" onClick={() => onApprove(ids)} disabled={actionPending}>
              <Check className="h-4 w-4 mr-1" />Approve{multi ? ` all ${slips.length}` : ''}
            </Button>
          )}
          {status !== 'rejected' && (
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => onReject(ids)} disabled={actionPending}>
              <X className="h-4 w-4 mr-1" />Reject{multi ? ` all ${slips.length}` : ''}
            </Button>
          )}
          {!multi && (
            <>
              <Button size="sm" variant="outline" onClick={() => onEdit(first)}>
                <Pencil className="h-4 w-4 mr-1" />Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(first.id)} aria-label="Delete timeslip">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MechanicTimeslipCard;
