import { supabase } from '@/integrations/supabase/client';

/**
 * Standard assumed minutes per task. Actual per-job start/finish times are not
 * recorded, so these are estimates — edit here to tune.
 */
export const STANDARD_MINUTES = {
  inspection: 45,
  boxMyBike: 20,
  foamMyBike: 15,
  repairFallback: 30,
} as const;

/** Difference (in minutes) between clocked time and recorded work that triggers the clock-out explanation. */
export const EXPLANATION_THRESHOLD_MINUTES = 30;

export type WorkKind = 'inspection' | 'repair' | 'box' | 'foam';

export interface WorkItem {
  kind: WorkKind;
  at: string; // ISO timestamp
  label: string;
  detail: string | null; // tracking number
  minutes: number;
}

export interface DayWork {
  items: WorkItem[];
  totalMinutes: number;
}

const londonDate = (iso: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));

async function loadLabourMinutes(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const { data, error } = await supabase.from('labour_times').select('repair_name, labour_minutes');
  if (error || !data) return map;
  for (const row of data as any[]) {
    const name = (row.repair_name || '').toLowerCase().trim();
    if (name && row.labour_minutes != null) map.set(name, Number(row.labour_minutes));
  }
  return map;
}

function matchRepairMinutes(description: string, labour: Map<string, number>): number {
  const desc = description.toLowerCase();
  for (const [name, minutes] of labour) {
    if (desc.includes(name) || name.includes(desc)) return minutes;
  }
  return STANDARD_MINUTES.repairFallback;
}

/**
 * Fetch the work a mechanic did across a set of dates (YYYY-MM-DD, Europe/London)
 * and group it by date. Covers inspections, repairs, Box My Bike and Foam My Bike.
 */
export async function getMechanicWorkByDate(
  userId: string,
  dates: string[]
): Promise<Record<string, DayWork>> {
  const result: Record<string, DayWork> = {};
  if (!dates.length) return result;
  const sorted = [...dates].sort();
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  // Wide UTC bounds so London-local days are fully covered in both GMT and BST.
  const from = `${min}T00:00:00Z`;
  const toDate = new Date(`${max}T00:00:00Z`);
  toDate.setUTCDate(toDate.getUTCDate() + 2);
  const to = toDate.toISOString();
  const wanted = new Set(dates);

  const [inspectionsRes, issuesRes, boxRes, foamRes, labour] = await Promise.all([
    supabase
      .from('bicycle_inspections')
      .select('inspected_at, bike_brand, bike_model, order_id')
      .eq('inspected_by_id', userId)
      .gte('inspected_at', from)
      .lte('inspected_at', to),
    supabase
      .from('inspection_issues')
      .select('resolved_at, issue_description, order_id')
      .eq('resolved_by_id', userId)
      .not('resolved_at', 'is', null)
      .gte('resolved_at', from)
      .lte('resolved_at', to),
    supabase
      .from('orders')
      .select('id, tracking_number, box_boxed_at')
      .eq('box_boxed_by_id', userId)
      .not('box_boxed_at', 'is', null)
      .gte('box_boxed_at', from)
      .lte('box_boxed_at', to),
    supabase
      .from('orders')
      .select('id, tracking_number, foam_foamed_at')
      .eq('foam_foamed_by_id', userId)
      .not('foam_foamed_at', 'is', null)
      .gte('foam_foamed_at', from)
      .lte('foam_foamed_at', to),
    loadLabourMinutes(),
  ]);

  // Tracking numbers for inspection/repair items.
  const orderIds = new Set<string>();
  (inspectionsRes.data || []).forEach((r: any) => r.order_id && orderIds.add(r.order_id));
  (issuesRes.data || []).forEach((r: any) => r.order_id && orderIds.add(r.order_id));
  const trackingById = new Map<string, string>();
  if (orderIds.size) {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, tracking_number')
      .in('id', Array.from(orderIds));
    (orders || []).forEach((o: any) => trackingById.set(o.id, o.tracking_number));
  }

  const add = (iso: string, item: WorkItem) => {
    const day = londonDate(iso);
    if (!wanted.has(day)) return;
    if (!result[day]) result[day] = { items: [], totalMinutes: 0 };
    result[day].items.push(item);
    result[day].totalMinutes += item.minutes;
  };

  for (const r of (inspectionsRes.data || []) as any[]) {
    const bike = [r.bike_brand, r.bike_model].filter(Boolean).join(' ') || 'Bike';
    add(r.inspected_at, {
      kind: 'inspection',
      at: r.inspected_at,
      label: `Inspection — ${bike}`,
      detail: r.order_id ? trackingById.get(r.order_id) ?? null : null,
      minutes: STANDARD_MINUTES.inspection,
    });
  }
  for (const r of (issuesRes.data || []) as any[]) {
    const desc = (r.issue_description || 'Repair').trim();
    add(r.resolved_at, {
      kind: 'repair',
      at: r.resolved_at,
      label: `Repair — ${desc}`,
      detail: r.order_id ? trackingById.get(r.order_id) ?? null : null,
      minutes: matchRepairMinutes(desc, labour),
    });
  }
  for (const r of (boxRes.data || []) as any[]) {
    add(r.box_boxed_at, {
      kind: 'box',
      at: r.box_boxed_at,
      label: 'Box My Bike — boxed',
      detail: r.tracking_number ?? null,
      minutes: STANDARD_MINUTES.boxMyBike,
    });
  }
  for (const r of (foamRes.data || []) as any[]) {
    add(r.foam_foamed_at, {
      kind: 'foam',
      at: r.foam_foamed_at,
      label: 'Foam My Bike — foamed',
      detail: r.tracking_number ?? null,
      minutes: STANDARD_MINUTES.foamMyBike,
    });
  }

  for (const day of Object.values(result)) {
    day.items.sort((a, b) => a.at.localeCompare(b.at));
  }
  return result;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
