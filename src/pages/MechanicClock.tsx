import React, { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import DashboardHeader from '@/components/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Camera, Clock, MapPin, LogIn, LogOut } from 'lucide-react';
import {
  clockIn,
  clockOut,
  getOpenSlipToday,
  listMyMechanicTimeslips,
  getSignedPhotoUrl,
  MechanicTimeslip,
} from '@/services/mechanicTimeslipService';
import { format, formatDistanceStrict } from 'date-fns';

async function requestPhoto(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment' as any;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('No photo selected'));
      resolve(file);
    };
    input.oncancel = () => reject(new Error('Photo capture cancelled'));
    input.click();
  });
}

async function requestLocation(): Promise<{ lat: number | null; lng: number | null }> {
  if (!('geolocation' in navigator)) return { lat: null, lng: null };
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

function ElapsedTimer({ startISO }: { startISO: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const start = new Date(startISO).getTime();
  const ms = Math.max(0, now - start);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return (
    <div className="text-5xl font-mono font-bold tabular-nums text-primary text-center py-4">
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </div>
  );
}

function PhotoThumb({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getSignedPhotoUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);
  if (!path) return null;
  if (!url) return <div className="w-12 h-12 bg-muted rounded" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="clock" className="w-12 h-12 object-cover rounded border" />
    </a>
  );
}

const MechanicClock: React.FC = () => {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: openSlip, isLoading } = useQuery({
    queryKey: ['mechanic-open-slip', user?.id],
    queryFn: () => (user?.id ? getOpenSlipToday(user.id) : Promise.resolve(null)),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const { data: history } = useQuery({
    queryKey: ['mechanic-slip-history', user?.id],
    queryFn: () => (user?.id ? listMyMechanicTimeslips(user.id) : Promise.resolve([])),
    enabled: !!user?.id,
  });

  const inMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not signed in');
      const photo = await requestPhoto();
      const loc = await requestLocation();
      const hourly = Number(userProfile?.workshop_hourly_rate ?? userProfile?.hourly_rate ?? 11);
      return clockIn({ driverId: user.id, hourlyRate: hourly, photo, lat: loc.lat, lng: loc.lng });
    },
    onSuccess: () => {
      toast.success('Clocked in');
      qc.invalidateQueries({ queryKey: ['mechanic-open-slip'] });
      qc.invalidateQueries({ queryKey: ['mechanic-slip-history'] });
    },
    onError: (e: any) => toast.error(e.message || 'Clock in failed'),
    onSettled: () => setBusy(false),
  });

  const outMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !openSlip) throw new Error('No open slip');
      const photo = await requestPhoto();
      const loc = await requestLocation();
      return clockOut({ slipId: openSlip.id, driverId: user.id, photo, lat: loc.lat, lng: loc.lng });
    },
    onSuccess: () => {
      toast.success('Clocked out');
      qc.invalidateQueries({ queryKey: ['mechanic-open-slip'] });
      qc.invalidateQueries({ queryKey: ['mechanic-slip-history'] });
    },
    onError: (e: any) => toast.error(e.message || 'Clock out failed'),
    onSettled: () => setBusy(false),
  });

  const handleClockIn = () => {
    setBusy(true);
    inMutation.mutate();
  };
  const handleClockOut = () => {
    setBusy(true);
    outMutation.mutate();
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        <DashboardHeader>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mechanic Clock</h1>
            <p className="text-muted-foreground">Clock in and out with a photo. Your time and pay are tracked automatically.</p>
          </div>
        </DashboardHeader>

        <MyTasksPanel />



        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {openSlip ? 'On the clock' : 'Not clocked in'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-muted-foreground text-center">Loading…</p>
            ) : openSlip ? (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Clocked in at {format(new Date(openSlip.clock_in_at), 'HH:mm')} on{' '}
                  {format(new Date(openSlip.clock_in_at), 'EEE d MMM')}
                </p>
                <ElapsedTimer startISO={openSlip.clock_in_at} />
                <Button size="lg" className="w-full" onClick={handleClockOut} disabled={busy}>
                  <LogOut className="h-5 w-5 mr-2" />
                  {busy ? 'Uploading…' : 'Take photo & clock out'}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Take a photo to start your shift. Your rate: £{Number(userProfile?.workshop_hourly_rate ?? userProfile?.hourly_rate ?? 11).toFixed(2)}/hr.
                </p>
                <Button size="lg" className="w-full" onClick={handleClockIn} disabled={busy}>
                  <LogIn className="h-5 w-5 mr-2" />
                  {busy ? 'Uploading…' : 'Take photo & clock in'}
                </Button>
              </>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
              <Camera className="h-3 w-3" /> Photo <MapPin className="h-3 w-3 ml-2" /> Location captured
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent shifts</CardTitle>
          </CardHeader>
          <CardContent>
            {history && history.length > 0 ? (
              <div className="divide-y">
                {history.map((s) => (
                  <div key={s.id} className="py-3 flex items-center gap-3">
                    <PhotoThumb path={s.clock_in_photo_url} />
                    <PhotoThumb path={s.clock_out_photo_url} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{format(new Date(s.date), 'EEE d MMM yyyy')}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(s.clock_in_at), 'HH:mm')} –{' '}
                        {s.clock_out_at ? format(new Date(s.clock_out_at), 'HH:mm') : 'open'}
                        {s.clock_out_at && ` · ${Number(s.total_hours).toFixed(2)}h`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">£{Number(s.total_pay || 0).toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground capitalize">{s.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No shifts yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default MechanicClock;
