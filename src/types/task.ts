export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const TASK_PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  created_by: string | null;
  linked_order_id: string | null;
  linked_conversation_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee?: { id: string; name: string | null; email: string | null } | null;
  creator?: { id: string; name: string | null; email: string | null } | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  author?: { id: string; name: string | null; email: string | null } | null;
}

export interface InternalUser {
  id: string;
  name: string | null;
  email: string | null;
}

export interface TaskFilters {
  status?: TaskStatus | 'all' | 'active';
  priority?: TaskPriority | 'all';
  assignee?: 'mine' | 'unassigned' | 'all' | string;
  due?: 'overdue' | 'today' | 'week' | 'all';
  linkedOrderId?: string;
  linkedConversationId?: string;
  search?: string;
  userId?: string;
}
