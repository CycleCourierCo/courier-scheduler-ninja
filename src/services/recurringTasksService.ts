import { supabase } from "@/integrations/supabase/client";
import type { TaskRecurrence } from "@/types/task";

const R = () => (supabase as any).from('task_recurrences');

export type RecurrenceInput = Omit<
  TaskRecurrence,
  'id' | 'created_at' | 'updated_at' | 'last_generated_on' | 'created_by'
>;

export async function listRecurrences(): Promise<TaskRecurrence[]> {
  const { data, error } = await R().select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as TaskRecurrence[];
}

export async function createRecurrence(input: RecurrenceInput, createdBy: string): Promise<void> {
  const { error } = await R().insert({ ...input, created_by: createdBy });
  if (error) throw error;
}

export async function updateRecurrence(id: string, patch: Partial<TaskRecurrence>): Promise<void> {
  const { error } = await R().update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteRecurrence(id: string): Promise<void> {
  const { error } = await R().delete().eq('id', id);
  if (error) throw error;
}

/** Runs the daily generator immediately (same code path as the nightly job). */
export async function generateRecurringNow(): Promise<{ created: number }> {
  const { data, error } = await supabase.functions.invoke('generate-recurring-tasks', {
    body: { manual: true },
  });
  if (error) throw error;
  return { created: (data as any)?.created ?? 0 };
}

/** Next date a recurrence will fire, on or after `from`. */
export function nextRunDate(r: TaskRecurrence, from = new Date()): string | null {
  const start = new Date(`${r.start_date}T00:00:00`);
  const end = r.end_date ? new Date(`${r.end_date}T00:00:00`) : null;
  let cursor = new Date(Math.max(start.getTime(), new Date(from.toDateString()).getTime()));
  for (let i = 0; i < 400; i++) {
    if (end && cursor > end) return null;
    if (matchesRecurrence(r, cursor)) {
      return cursor.toISOString().slice(0, 10);
    }
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return null;
}

export function matchesRecurrence(r: TaskRecurrence, date: Date): boolean {
  const start = new Date(`${r.start_date}T00:00:00`);
  if (date < start) return false;
  if (r.end_date && date > new Date(`${r.end_date}T00:00:00`)) return false;
  const dow = date.getDay(); // 0 = Sunday
  const interval = Math.max(1, r.interval_n || 1);

  switch (r.frequency) {
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'days_of_week':
      return (r.days_of_week || []).includes(dow);
    case 'weekly': {
      const days = (r.days_of_week || []).length ? r.days_of_week : [start.getDay()];
      if (!days.includes(dow)) return false;
      const weeks = Math.floor((startOfWeek(date).getTime() - startOfWeek(start).getTime()) / (7 * 86400000));
      return weeks % interval === 0;
    }
    case 'monthly': {
      if (date.getDate() !== start.getDate()) return false;
      const months =
        (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
      return months % interval === 0;
    }
    default:
      return false;
  }
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const shift = (copy.getDay() + 6) % 7; // Monday start
  copy.setDate(copy.getDate() - shift);
  return copy;
}
