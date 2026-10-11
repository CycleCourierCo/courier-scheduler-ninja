import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { MapPin, Check, X, Pencil, Trash2, LogIn, LogOut, Wrench } from 'lucide-react';
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

interface MechanicTimeslipCardProps {
  slip: MechanicTimeslip;
  work?: DayWork;
  actionPending?: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (slip: MechanicTimeslip) => void;
  onDelete: (id: string) => void;
}

const MechanicTimeslipCard: React.FC<MechanicTimeslipCardProps> = ({
  slip: s,
  work,
  actionPending,
  onApprove,
  onReject,
  onEdit,
  onDelete,
}) => {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold break-words">{s.driver?.name || s.driver?.email || '—'}</div>
            <div className="text-xs text-muted-foreground">{format(new Date(s.date), 'EEE d MMM yyyy')}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className="gap-1">
              <Wrench className="h-3 w-3" /> Mechanic
            </Badge>
            <Badge variant={statusVariant(s.status)} className="capitalize">{s.status}</Badge>
          </div>
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

        {s.clock_out_explanation && (
          <div className="text-xs rounded-md border bg-amber-50 dark:bg-amber-950/30 p-2 break-words">
            <span className="font-medium">Clock-out explanation:</span> {s.clock_out_explanation}
          </div>
        )}

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
          {s.status !== 'approved' && s.clock_out_at && (
            <Button size="sm" className="flex-1 sm:flex-none" onClick={() => onApprove(s.id)} disabled={actionPending}>
              <Check className="h-4 w-4 mr-1" />Approve
            </Button>
          )}
          {s.status !== 'rejected' && (
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => onReject(s.id)} disabled={actionPending}>
              <X className="h-4 w-4 mr-1" />Reject
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onEdit(s)}>
            <Pencil className="h-4 w-4 mr-1" />Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(s.id)} aria-label="Delete timeslip">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MechanicTimeslipCard;
