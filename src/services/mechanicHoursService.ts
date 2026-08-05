import { supabase } from '@/integrations/supabase/client';

export interface MechanicHoursDaily {
  date: string;
  label: string;
  hours: number;
  inspections: number;
  repairs: number;
  jobsPerHour: number;
}

export interface MechanicHoursPerMechanic {
  mechanicId: string;
  name: string;
  hours: number;
  inspections: number;
  repairs: number;
  jobsPerHour: number;
  minutesPerJob: number;
}

export interface MechanicHoursResult {
  daily: MechanicHoursDaily[];
  perMechanic: MechanicHoursPerMechanic[];
  totals: {
    hours: number;
    inspections: number;
    repairs: number;
    jobsPerHour: number;
    minutesPerJob: number;
  };
}

/** Bucket an ISO timestamp into a Europe/London YYYY-MM-DD day key. */
const londonDay = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  // en-CA gives YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
};

const labelFor = (dayKey: string): string => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
};

/**
 * Compare mechanic clocked hours per day with the inspections completed and
 * repairs (resolved issues) completed on the same day.
 */
export async function getMechanicHours(fromISO: string, toISO: string): Promise<MechanicHoursResult> {
  const dateFrom = fromISO.slice(0, 10);
  const dateTo = toISO.slice(0, 10);

  const [slipsRes, inspectionsRes, issuesRes] = await Promise.all([
    supabase
      .from('mechanic_timeslips')
      .select('driver_id, date, total_hours, status, driver:profiles!mechanic_timeslips_driver_id_fkey(id,name,email)')
      .in('status', ['closed', 'approved'])
      .gte('date', dateFrom)
      .lte('date', dateTo),
    supabase
      .from('bicycle_inspections')
      .select('id, inspected_at, inspected_by_id, inspected_by_name')
      .not('inspected_at', 'is', null)
      .gte('inspected_at', fromISO)
      .lte('inspected_at', toISO),
    supabase
      .from('inspection_issues')
      .select('id, resolved_at, resolved_by_id, resolved_by_name, status')
      .in('status', ['resolved', 'repaired'])
      .not('resolved_at', 'is', null)
      .gte('resolved_at', fromISO)
      .lte('resolved_at', toISO),
  ]);

  if (slipsRes.error) throw slipsRes.error;
  if (inspectionsRes.error) throw inspectionsRes.error;
  if (issuesRes.error) throw issuesRes.error;

  const dayMap = new Map<string, { hours: number; inspections: number; repairs: number }>();
  const ensureDay = (key: string) => {
    let entry = dayMap.get(key);
    if (!entry) {
      entry = { hours: 0, inspections: 0, repairs: 0 };
      dayMap.set(key, entry);
    }
    return entry;
  };

  const mechMap = new Map<string, MechanicHoursPerMechanic>();
  const ensureMech = (id: string, name: string | null | undefined) => {
    let row = mechMap.get(id);
    if (!row) {
      row = {
        mechanicId: id,
        name: name || 'Unknown mechanic',
        hours: 0,
        inspections: 0,
        repairs: 0,
        jobsPerHour: 0,
        minutesPerJob: 0,
      };
      mechMap.set(id, row);
    } else if ((!row.name || row.name === 'Unknown mechanic') && name) {
      row.name = name;
    }
    return row;
  };

  (slipsRes.data || []).forEach((s: any) => {
    const key = typeof s.date === 'string' ? s.date.slice(0, 10) : null;
    const hours = Number(s.total_hours || 0);
    if (key) ensureDay(key).hours += hours;
    if (s.driver_id) {
      const name = s.driver?.name || s.driver?.email || null;
      ensureMech(s.driver_id, name).hours += hours;
    }
  });

  (inspectionsRes.data || []).forEach((i: any) => {
    const key = londonDay(i.inspected_at);
    if (key) ensureDay(key).inspections += 1;
    if (i.inspected_by_id) ensureMech(i.inspected_by_id, i.inspected_by_name).inspections += 1;
  });

  (issuesRes.data || []).forEach((iss: any) => {
    const key = londonDay(iss.resolved_at);
    if (key) ensureDay(key).repairs += 1;
    if (iss.resolved_by_id) ensureMech(iss.resolved_by_id, iss.resolved_by_name).repairs += 1;
  });

  const daily: MechanicHoursDaily[] = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      date,
      label: labelFor(date),
      hours: Math.round(v.hours * 10) / 10,
      inspections: v.inspections,
      repairs: v.repairs,
      jobsPerHour: v.hours > 0 ? (v.inspections + v.repairs) / v.hours : 0,
    }));

  const perMechanic = Array.from(mechMap.values()).map((r) => {
    const jobs = r.inspections + r.repairs;
    r.hours = Math.round(r.hours * 10) / 10;
    r.jobsPerHour = r.hours > 0 ? jobs / r.hours : 0;
    r.minutesPerJob = jobs > 0 ? (r.hours * 60) / jobs : 0;
    return r;
  });
  perMechanic.sort((a, b) => b.jobsPerHour - a.jobsPerHour);

  const totalHours = daily.reduce((s, d) => s + d.hours, 0);
  const totalInspections = daily.reduce((s, d) => s + d.inspections, 0);
  const totalRepairs = daily.reduce((s, d) => s + d.repairs, 0);
  const totalJobs = totalInspections + totalRepairs;

  return {
    daily,
    perMechanic,
    totals: {
      hours: Math.round(totalHours * 10) / 10,
      inspections: totalInspections,
      repairs: totalRepairs,
      jobsPerHour: totalHours > 0 ? totalJobs / totalHours : 0,
      minutesPerJob: totalJobs > 0 ? (totalHours * 60) / totalJobs : 0,
    },
  };
}
