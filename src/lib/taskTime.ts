import type { Task } from "@/types/task";

/** Working day shown on the weekly plan grid. */
export const DAY_START_MINUTES = 7 * 60; // 07:00
export const DAY_END_MINUTES = 19 * 60; // 19:00
export const SLOT_MINUTES = 30;
export const SLOT_COUNT = (DAY_END_MINUTES - DAY_START_MINUTES) / SLOT_MINUTES;
/** Height of one 30-minute row, in px. */
export const SLOT_HEIGHT = 28;

/** Tasks without a length count as half an hour. */
export const DEFAULT_TASK_MINUTES = 30;

export const taskMinutes = (task: Task): number =>
  Math.max(5, task.estimated_minutes || DEFAULT_TASK_MINUTES);

/** "1h 30m", "45m", "2h" */
export const formatLength = (minutes: number): string => {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest}m`;
  if (!rest) return `${h}h`;
  return `${h}h ${rest}m`;
};

/** "09:30:00" / "09:30" -> minutes from midnight; null when unset or unreadable. */
export const parseTimeToMinutes = (time?: string | null): number | null => {
  if (!time) return null;
  const [h, m] = time.split(":");
  const hours = parseInt(h, 10);
  const mins = parseInt(m ?? "0", 10);
  if (Number.isNaN(hours) || Number.isNaN(mins)) return null;
  return hours * 60 + mins;
};

/** minutes from midnight -> "09:30" */
export const minutesToLabel = (minutes: number): string => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** minutes from midnight -> "09:30:00" for the database `time` column. */
export const minutesToTimeValue = (minutes: number): string => `${minutesToLabel(minutes)}:00`;

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export interface LaidOutTask {
  task: Task;
  /** Start, in minutes from midnight. */
  start: number;
  minutes: number;
}

/**
 * Lay a day's tasks out down the grid: fixed start times stay where they are,
 * everything else queues from 07:00 in priority order, filling the first gap.
 */
export const layOutDay = (tasks: Task[]): LaidOutTask[] => {
  const fixed: LaidOutTask[] = [];
  const floating: Task[] = [];

  for (const task of tasks) {
    const start = parseTimeToMinutes(task.start_time);
    if (start === null) floating.push(task);
    else fixed.push({ task, start, minutes: taskMinutes(task) });
  }

  fixed.sort((a, b) => a.start - b.start);
  floating.sort((a, b) => {
    const p = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
    if (p !== 0) return p;
    return a.created_at.localeCompare(b.created_at);
  });

  const placed = [...fixed];
  const overlaps = (start: number, minutes: number) =>
    placed.some((p) => start < p.start + p.minutes && p.start < start + minutes);

  for (const task of floating) {
    const minutes = taskMinutes(task);
    let start = DAY_START_MINUTES;
    // Step forward slot by slot until the block fits.
    while (overlaps(start, minutes) && start < DAY_END_MINUTES + 12 * 60) {
      start += SLOT_MINUTES;
    }
    placed.push({ task, start, minutes });
  }

  return placed.sort((a, b) => a.start - b.start);
};

export const totalDayMinutes = (tasks: Task[]): number =>
  tasks.reduce((sum, t) => sum + taskMinutes(t), 0);
