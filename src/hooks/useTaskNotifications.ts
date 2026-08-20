import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/types/task";

const ACTIVE = ['open', 'in_progress', 'blocked'];

async function fetchAssignedTasks(userId: string): Promise<Task[]> {
  const { data, error } = await (supabase as any)
    .from('tasks')
    .select('*, assignee:profiles!tasks_assignee_id_fkey(id, name, email), creator:profiles!tasks_created_by_fkey(id, name, email)')
    .eq('assignee_id', userId)
    .in('status', ACTIVE)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data || []) as Task[];
}

async function fetchSeenAt(userId: string): Promise<string | null> {
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('task_notifications_seen_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.task_notifications_seen_at as string | null) ?? null;
}

export function useTaskNotifications(userId: string | undefined, enabled = true) {
  const qc = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: ['task-notifications', userId],
    queryFn: () => fetchAssignedTasks(userId as string),
    enabled: !!userId && enabled,
  });

  const seenQuery = useQuery({
    queryKey: ['task-notifications-seen', userId],
    queryFn: () => fetchSeenAt(userId as string),
    enabled: !!userId && enabled,
  });

  useEffect(() => {
    if (!userId || !enabled) return;
    const ch = supabase
      .channel(`task-notifications-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        qc.invalidateQueries({ queryKey: ['task-notifications', userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, enabled, qc]);

  const tasks = tasksQuery.data || [];
  const seenAt = seenQuery.data ? new Date(seenQuery.data).getTime() : 0;
  const unseen = tasks.filter(t => new Date(t.created_at).getTime() > seenAt);

  const markAllSeen = useCallback(async () => {
    if (!userId || unseen.length === 0) return;
    const stamp = new Date().toISOString();
    await (supabase as any).from('profiles').update({ task_notifications_seen_at: stamp }).eq('id', userId);
    qc.setQueryData(['task-notifications-seen', userId], stamp);
  }, [userId, unseen.length, qc]);

  return { tasks, unseenCount: unseen.length, unseenIds: new Set(unseen.map(t => t.id)), markAllSeen, isLoading: tasksQuery.isLoading };
}
