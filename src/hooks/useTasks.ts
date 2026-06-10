import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listTasks, getTask, listTaskComments, listInternalUsers } from "@/services/tasksService";
import type { TaskFilters } from "@/types/task";

export function useTasks(filters: TaskFilters) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => listTasks(filters),
  });

  useEffect(() => {
    const ch = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        qc.invalidateQueries({ queryKey: ['tasks'] });
        qc.invalidateQueries({ queryKey: ['task'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return query;
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => getTask(id as string),
    enabled: !!id,
  });
}

export function useTaskComments(id: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['task-comments', id],
    queryFn: () => listTaskComments(id as string),
    enabled: !!id,
  });
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`task-comments-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ['task-comments', id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);
  return query;
}

export function useInternalUsers() {
  return useQuery({
    queryKey: ['internal-users'],
    queryFn: listInternalUsers,
    staleTime: 5 * 60 * 1000,
  });
}
