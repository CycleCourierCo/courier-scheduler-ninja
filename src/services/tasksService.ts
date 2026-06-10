import { supabase } from "@/integrations/supabase/client";
import type { Task, TaskComment, TaskFilters, InternalUser } from "@/types/task";

const T = () => (supabase as any).from('tasks');
const C = () => (supabase as any).from('task_comments');

const TASK_SELECT = `
  *,
  assignee:profiles!tasks_assignee_id_fkey(id, name, email),
  creator:profiles!tasks_created_by_fkey(id, name, email)
`;

export async function listTasks(filters: TaskFilters = {}): Promise<Task[]> {
  let q = T().select(TASK_SELECT).order('created_at', { ascending: false }).limit(500);

  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'active') {
      q = q.in('status', ['open', 'in_progress', 'blocked']);
    } else {
      q = q.eq('status', filters.status);
    }
  }
  if (filters.priority && filters.priority !== 'all') q = q.eq('priority', filters.priority);

  if (filters.assignee === 'mine' && filters.userId) q = q.eq('assignee_id', filters.userId);
  else if (filters.assignee === 'unassigned') q = q.is('assignee_id', null);
  else if (filters.assignee && filters.assignee !== 'all') q = q.eq('assignee_id', filters.assignee);

  if (filters.linkedOrderId) q = q.eq('linked_order_id', filters.linkedOrderId);
  if (filters.linkedConversationId) q = q.eq('linked_conversation_id', filters.linkedConversationId);

  if (filters.due === 'overdue') q = q.lt('due_date', new Date().toISOString()).not('status', 'in', '(done,cancelled)');
  else if (filters.due === 'today') {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    q = q.gte('due_date', start.toISOString()).lte('due_date', end.toISOString());
  } else if (filters.due === 'week') {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setDate(end.getDate()+7); end.setHours(23,59,59,999);
    q = q.gte('due_date', start.toISOString()).lte('due_date', end.toISOString());
  }

  const { data, error } = await q;
  if (error) throw error;
  let rows = (data || []) as Task[];
  if (filters.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter(r =>
      r.title.toLowerCase().includes(s) ||
      (r.description || '').toLowerCase().includes(s)
    );
  }
  return rows;
}

export async function getTask(id: string): Promise<Task> {
  const { data, error } = await T().select(TASK_SELECT).eq('id', id).single();
  if (error) throw error;
  return data as Task;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  priority?: Task['priority'];
  due_date?: string | null;
  assignee_id?: string | null;
  linked_order_id?: string | null;
  linked_conversation_id?: string | null;
}

export async function createTask(input: CreateTaskInput, createdBy: string): Promise<Task> {
  const payload = {
    title: input.title,
    description: input.description ?? null,
    priority: input.priority ?? 'normal',
    due_date: input.due_date ?? null,
    assignee_id: input.assignee_id ?? null,
    linked_order_id: input.linked_order_id ?? null,
    linked_conversation_id: input.linked_conversation_id ?? null,
    created_by: createdBy,
    status: 'open',
  };
  const { data, error } = await T().insert(payload).select(TASK_SELECT).single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  const { error } = await T().update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await T().delete().eq('id', id);
  if (error) throw error;
}

export async function listTaskComments(taskId: string): Promise<TaskComment[]> {
  const { data, error } = await C()
    .select('*, author:profiles!task_comments_author_id_fkey(id, name, email)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as TaskComment[];
}

export async function addTaskComment(taskId: string, body: string, authorId: string): Promise<void> {
  const { error } = await C().insert({ task_id: taskId, body, author_id: authorId });
  if (error) throw error;
}

export async function listInternalUsers(): Promise<InternalUser[]> {
  const { data, error } = await (supabase as any).rpc('list_internal_users');
  if (error) throw error;
  return (data || []) as InternalUser[];
}
