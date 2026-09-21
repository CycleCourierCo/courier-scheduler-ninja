import type { CsPriority } from "@/types/customerService";

/** Styling for each priority badge — semantic tokens only. */
export const priorityBadgeClass = (p: CsPriority): string => {
  switch (p) {
    case 'urgent':
      return 'bg-destructive text-destructive-foreground';
    case 'high':
      return 'bg-warning text-warning-foreground';
    case 'low':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-secondary text-secondary-foreground';
  }
};

export interface DueInfo {
  label: string;
  overdue: boolean;
  soon: boolean;
}

/** Human "due in 2h 10m" / "overdue 40m" text for a reply deadline. */
export const describeDue = (dueAt: string | null | undefined, now: Date = new Date()): DueInfo | null => {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return null;

  const diffMs = due - now.getTime();
  const overdue = diffMs < 0;
  const mins = Math.max(0, Math.round(Math.abs(diffMs) / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rest = mins % 60;

  let span: string;
  if (days > 0) span = `${days}d ${hours}h`;
  else if (hours > 0) span = `${hours}h ${rest}m`;
  else span = `${rest}m`;

  return {
    label: overdue ? `overdue ${span}` : `due in ${span}`,
    overdue,
    soon: !overdue && mins <= 60,
  };
};

export const dueBadgeClass = (info: DueInfo): string =>
  info.overdue
    ? 'bg-destructive text-destructive-foreground'
    : info.soon
      ? 'bg-warning text-warning-foreground'
      : 'bg-muted text-muted-foreground';

export const formatTargetMinutes = (mins: number): string => {
  if (mins % 1440 === 0) return `${mins / 1440} day${mins === 1440 ? '' : 's'}`;
  if (mins % 60 === 0) return `${mins / 60} hour${mins === 60 ? '' : 's'}`;
  return `${mins} min`;
};
