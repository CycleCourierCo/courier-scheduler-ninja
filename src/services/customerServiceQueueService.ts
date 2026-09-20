import { supabase } from "@/integrations/supabase/client";
import type { CsPriority, CsQueue, CsQueueMember, CsQueueSla } from "@/types/customerService";

const db = () => supabase as any;

export interface StaffOption { id: string; name: string | null; email: string | null }

export const fetchQueues = async (): Promise<CsQueue[]> => {
  const { data, error } = await db()
    .from('cs_queues')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as CsQueue[];
};

export const fetchQueueMembers = async (): Promise<CsQueueMember[]> => {
  const { data, error } = await db()
    .from('cs_queue_members')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []) as CsQueueMember[];
};

export const fetchQueueSlas = async (): Promise<CsQueueSla[]> => {
  const { data, error } = await db().from('cs_queue_slas').select('*');
  if (error) throw error;
  return (data || []) as CsQueueSla[];
};

export const fetchStaffOptions = async (): Promise<StaffOption[]> => {
  const { data, error } = await db().rpc('list_internal_users');
  if (error) throw error;
  return (data || []) as StaffOption[];
};

export const createQueue = async (name: string, description?: string) => {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const { data, error } = await db()
    .from('cs_queues')
    .insert({ name: name.trim(), slug, description: description?.trim() || null })
    .select()
    .single();
  if (error) throw error;

  // Give the new queue the standard reply-time targets.
  const defaults: Array<{ priority: CsPriority; target_minutes: number }> = [
    { priority: 'low', target_minutes: 1440 },
    { priority: 'normal', target_minutes: 480 },
    { priority: 'high', target_minutes: 120 },
    { priority: 'urgent', target_minutes: 30 },
  ];
  await db().from('cs_queue_slas').insert(
    defaults.map((d) => ({ queue_id: data.id, ...d })),
  );
  return data as CsQueue;
};

export const updateQueue = async (id: string, patch: Partial<CsQueue>) => {
  const { error } = await db().from('cs_queues').update(patch).eq('id', id);
  if (error) throw error;
};

export const setDefaultQueue = async (id: string) => {
  const { error: clearErr } = await db()
    .from('cs_queues')
    .update({ is_default: false })
    .eq('is_default', true);
  if (clearErr) throw clearErr;
  const { error } = await db().from('cs_queues').update({ is_default: true }).eq('id', id);
  if (error) throw error;
};

export const addQueueMember = async (queueId: string, userId: string) => {
  const { error } = await db()
    .from('cs_queue_members')
    .upsert({ queue_id: queueId, user_id: userId, is_active: true }, { onConflict: 'queue_id,user_id' });
  if (error) throw error;
};

export const setQueueMemberActive = async (id: string, isActive: boolean) => {
  const { error } = await db().from('cs_queue_members').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
};

export const removeQueueMember = async (id: string) => {
  const { error } = await db().from('cs_queue_members').delete().eq('id', id);
  if (error) throw error;
};

export const upsertQueueSla = async (queueId: string, priority: CsPriority, targetMinutes: number) => {
  const { error } = await db()
    .from('cs_queue_slas')
    .upsert({ queue_id: queueId, priority, target_minutes: targetMinutes }, { onConflict: 'queue_id,priority' });
  if (error) throw error;
};
