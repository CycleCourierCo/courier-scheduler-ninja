import { supabase } from '@/integrations/supabase/client';

export interface MechanicTimeslip {
  id: string;
  driver_id: string;
  date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  clock_in_photo_url: string | null;
  clock_out_photo_url: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  location_missing: boolean;
  hourly_rate: number;
  lunch_hours: number;
  total_hours: number;
  total_pay: number;
  status: 'open' | 'closed' | 'approved' | 'rejected';
  admin_notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  driver?: { id: string; name: string | null; email: string | null; hourly_rate?: number | null; workshop_hourly_rate?: number | null };
}

const BUCKET = 'mechanic-clock-photos';

async function uploadPhoto(userId: string, slipId: string, kind: 'in' | 'out', blob: Blob): Promise<string> {
  const path = `${userId}/${slipId}-${kind}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function getSignedPhotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

export async function getOpenSlipToday(driverId: string): Promise<MechanicTimeslip | null> {
  const { data, error } = await supabase
    .from('mechanic_timeslips')
    .select('*')
    .eq('driver_id', driverId)
    .eq('status', 'open')
    .order('clock_in_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as any) || null;
}

export async function listMyMechanicTimeslips(driverId: string): Promise<MechanicTimeslip[]> {
  const { data, error } = await supabase
    .from('mechanic_timeslips')
    .select('*')
    .eq('driver_id', driverId)
    .order('clock_in_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data || []) as any;
}

export async function listAllMechanicTimeslips(filters?: {
  driverId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<MechanicTimeslip[]> {
  let q = supabase
    .from('mechanic_timeslips')
    .select('*, driver:profiles!mechanic_timeslips_driver_id_fkey(id,name,email,hourly_rate,workshop_hourly_rate)')
    .order('clock_in_at', { ascending: false });
  if (filters?.driverId) q = q.eq('driver_id', filters.driverId);
  if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
  if (filters?.dateFrom) q = q.gte('date', filters.dateFrom);
  if (filters?.dateTo) q = q.lte('date', filters.dateTo);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as any;
}

export async function clockIn(params: {
  driverId: string;
  hourlyRate: number;
  photo: Blob;
  lat: number | null;
  lng: number | null;
}): Promise<MechanicTimeslip> {
  // Insert row first to get id
  const { data: inserted, error: insErr } = await supabase
    .from('mechanic_timeslips')
    .insert({
      driver_id: params.driverId,
      hourly_rate: params.hourlyRate,
      clock_in_lat: params.lat,
      clock_in_lng: params.lng,
      location_missing: params.lat === null || params.lng === null,
    })
    .select()
    .single();
  if (insErr) throw insErr;
  const path = await uploadPhoto(params.driverId, inserted.id, 'in', params.photo);
  const { data: updated, error: updErr } = await supabase
    .from('mechanic_timeslips')
    .update({ clock_in_photo_url: path })
    .eq('id', inserted.id)
    .select()
    .single();
  if (updErr) throw updErr;
  return updated as any;
}

export async function clockOut(params: {
  slipId: string;
  driverId: string;
  photo: Blob;
  lat: number | null;
  lng: number | null;
}): Promise<MechanicTimeslip> {
  const path = await uploadPhoto(params.driverId, params.slipId, 'out', params.photo);
  const { data, error } = await supabase
    .from('mechanic_timeslips')
    .update({
      clock_out_at: new Date().toISOString(),
      clock_out_photo_url: path,
      clock_out_lat: params.lat,
      clock_out_lng: params.lng,
      status: 'closed',
      location_missing: params.lat === null || params.lng === null,
    })
    .eq('id', params.slipId)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function updateMechanicTimeslip(
  id: string,
  updates: Partial<Pick<MechanicTimeslip, 'hourly_rate' | 'lunch_hours' | 'status' | 'admin_notes' | 'clock_in_at' | 'clock_out_at'>>
): Promise<MechanicTimeslip> {
  const payload: any = { ...updates };
  if (updates.status === 'approved') {
    const { data: userData } = await supabase.auth.getUser();
    payload.approved_at = new Date().toISOString();
    payload.approved_by = userData?.user?.id ?? null;
  }
  const { data, error } = await supabase
    .from('mechanic_timeslips')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function deleteMechanicTimeslip(id: string): Promise<void> {
  const { error } = await supabase.from('mechanic_timeslips').delete().eq('id', id);
  if (error) throw error;
}
