import { supabase } from '@/integrations/supabase/client';

export type StandardMinutesSource = 'catalogue' | 'labour_cost' | 'default' | 'inspection';

export interface MechanicJobRow {
  id: string;
  type: 'inspection' | 'repair';
  label: string;
  minutes: number;
  source: StandardMinutesSource;
}

export interface MechanicHoursDaily {
  date: string;
  label: string;
  hours: number;
  standardHours: number;
  varianceHours: number;
  efficiencyPct: number;
  inspections: number;
  repairs: number;
  jobsPerHour: number;
}

export interface MechanicDayBreakdown {
  date: string;
  label: string;
  hours: number;
  standardHours: number;
  varianceHours: number;
  jobs: MechanicJobRow[];
}

export interface MechanicHoursPerMechanic {
  mechanicId: string;
  name: string;
  hours: number;
  standardHours: number;
  varianceHours: number;
  efficiencyPct: number;
  inspections: number;
  repairs: number;
  jobsPerHour: number;
  minutesPerJob: number;
  days: MechanicDayBreakdown[];
}

export interface MechanicHoursResult {
  daily: MechanicHoursDaily[];
  perMechanic: MechanicHoursPerMechanic[];
  totals: {
    hours: number;
    standardHours: number;
    varianceHours: number;
    efficiencyPct: number;
    inspections: number;
    repairs: number;
    jobsPerHour: number;
    minutesPerJob: number;
    catalogueCoveragePct: number;
  };
  settings: {
    hourlyRate: number;
    inspectionMinutes: number;
    defaultRepairMinutes: number;
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

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Compare mechanic clocked hours per day with the "standard" (earned) hours the
 * work completed that day is worth, so 10 jobs worth 7 hours can be matched
 * against the 7 hours actually clocked.
 */
export async function getMechanicHours(fromISO: string, toISO: string): Promise<MechanicHoursResult> {
  const dateFrom = fromISO.slice(0, 10);
  const dateTo = toISO.slice(0, 10);

  const [slipsRes, inspectionsRes, issuesRes, settingsRes] = await Promise.all([
    supabase
      .from('mechanic_timeslips')
      .select('driver_id, date, total_hours, status, driver:profiles!mechanic_timeslips_driver_id_fkey(id,name,email)')
      .in('status', ['closed', 'approved'])
      .gte('date', dateFrom)
      .lte('date', dateTo),
    supabase
      .from('bicycle_inspections')
      .select('id, inspected_at, inspected_by_id, inspected_by_name, bike_type')
      .not('inspected_at', 'is', null)
      .gte('inspected_at', fromISO)
      .lte('inspected_at', toISO),
    supabase
      .from('inspection_issues')
      .select('id, resolved_at, resolved_by_id, resolved_by_name, status, repair_id, labour_cost, issue_description, labour:labour_times!inspection_issues_repair_id_fkey(repair_id,repair_name,labour_minutes)')
      .in('status', ['resolved', 'repaired'])
      .not('resolved_at', 'is', null)
      .gte('resolved_at', fromISO)
      .lte('resolved_at', toISO),
    supabase
      .from('workshop_settings')
      .select('hourly_rate_gbp, inspection_standard_minutes, default_repair_minutes')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  if (slipsRes.error) throw slipsRes.error;
  if (inspectionsRes.error) throw inspectionsRes.error;
  if (issuesRes.error) throw issuesRes.error;

  const hourlyRate = Number(settingsRes.data?.hourly_rate_gbp ?? 75) || 75;
  const inspectionMinutes = Number(settingsRes.data?.inspection_standard_minutes ?? 30) || 0;
  const defaultRepairMinutes = Number(settingsRes.data?.default_repair_minutes ?? 30) || 0;

  interface DayAgg {
    hours: number;
    standardMinutes: number;
    inspections: number;
    repairs: number;
  }
  const dayMap = new Map<string, DayAgg>();
  const ensureDay = (key: string): DayAgg => {
    let entry = dayMap.get(key);
    if (!entry) {
      entry = { hours: 0, standardMinutes: 0, inspections: 0, repairs: 0 };
      dayMap.set(key, entry);
    }
    return entry;
  };

  interface MechAgg extends Omit<MechanicHoursPerMechanic, 'days'> {
    standardMinutes: number;
    dayMap: Map<string, { hours: number; standardMinutes: number; jobs: MechanicJobRow[] }>;
  }
  const mechMap = new Map<string, MechAgg>();
  const ensureMech = (id: string, name: string | null | undefined): MechAgg => {
    let row = mechMap.get(id);
    if (!row) {
      row = {
        mechanicId: id,
        name: name || 'Unknown mechanic',
        hours: 0,
        standardHours: 0,
        varianceHours: 0,
        efficiencyPct: 0,
        inspections: 0,
        repairs: 0,
        jobsPerHour: 0,
        minutesPerJob: 0,
        standardMinutes: 0,
        dayMap: new Map(),
      };
      mechMap.set(id, row);
    } else if ((!row.name || row.name === 'Unknown mechanic') && name) {
      row.name = name;
    }
    return row;
  };
  const ensureMechDay = (mech: MechAgg, key: string) => {
    let d = mech.dayMap.get(key);
    if (!d) {
      d = { hours: 0, standardMinutes: 0, jobs: [] };
      mech.dayMap.set(key, d);
    }
    return d;
  };

  (slipsRes.data || []).forEach((s: any) => {
    const key = typeof s.date === 'string' ? s.date.slice(0, 10) : null;
    const hours = Number(s.total_hours || 0);
    if (key) ensureDay(key).hours += hours;
    if (s.driver_id) {
      const name = s.driver?.name || s.driver?.email || null;
      const mech = ensureMech(s.driver_id, name);
      mech.hours += hours;
      if (key) ensureMechDay(mech, key).hours += hours;
    }
  });

  (inspectionsRes.data || []).forEach((i: any) => {
    const key = londonDay(i.inspected_at);
    if (key) {
      const day = ensureDay(key);
      day.inspections += 1;
      day.standardMinutes += inspectionMinutes;
    }
    if (i.inspected_by_id) {
      const mech = ensureMech(i.inspected_by_id, i.inspected_by_name);
      mech.inspections += 1;
      mech.standardMinutes += inspectionMinutes;
      if (key) {
        const d = ensureMechDay(mech, key);
        d.standardMinutes += inspectionMinutes;
        d.jobs.push({
          id: i.id,
          type: 'inspection',
          label: `Inspection${i.bike_type ? ` — ${i.bike_type}` : ''}`,
          minutes: inspectionMinutes,
          source: 'inspection',
        });
      }
    }
  });

  let catalogueRepairs = 0;
  let totalRepairRows = 0;

  (issuesRes.data || []).forEach((iss: any) => {
    const key = londonDay(iss.resolved_at);
    totalRepairRows += 1;

    const catalogueMinutes = Number(iss.labour?.labour_minutes ?? 0);
    const labourCost = Number(iss.labour_cost ?? 0);
    let minutes = 0;
    let source: StandardMinutesSource = 'default';
    if (catalogueMinutes > 0) {
      minutes = catalogueMinutes;
      source = 'catalogue';
      catalogueRepairs += 1;
    } else if (labourCost > 0 && hourlyRate > 0) {
      minutes = (labourCost / hourlyRate) * 60;
      source = 'labour_cost';
    } else {
      minutes = defaultRepairMinutes;
      source = 'default';
    }

    if (key) {
      const day = ensureDay(key);
      day.repairs += 1;
      day.standardMinutes += minutes;
    }
    if (iss.resolved_by_id) {
      const mech = ensureMech(iss.resolved_by_id, iss.resolved_by_name);
      mech.repairs += 1;
      mech.standardMinutes += minutes;
      if (key) {
        const d = ensureMechDay(mech, key);
        d.standardMinutes += minutes;
        d.jobs.push({
          id: iss.id,
          type: 'repair',
          label: iss.labour?.repair_name || iss.issue_description || 'Repair',
          minutes: Math.round(minutes),
          source,
        });
      }
    }
  });

  const daily: MechanicHoursDaily[] = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => {
      const hours = round1(v.hours);
      const standardHours = round1(v.standardMinutes / 60);
      return {
        date,
        label: labelFor(date),
        hours,
        standardHours,
        varianceHours: round1(standardHours - hours),
        efficiencyPct: hours > 0 ? (standardHours / hours) * 100 : 0,
        inspections: v.inspections,
        repairs: v.repairs,
        jobsPerHour: v.hours > 0 ? (v.inspections + v.repairs) / v.hours : 0,
      };
    });

  const perMechanic: MechanicHoursPerMechanic[] = Array.from(mechMap.values()).map((r) => {
    const jobs = r.inspections + r.repairs;
    const hours = round1(r.hours);
    const standardHours = round1(r.standardMinutes / 60);
    const days: MechanicDayBreakdown[] = Array.from(r.dayMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, d]) => {
        const dh = round1(d.hours);
        const dsh = round1(d.standardMinutes / 60);
        return {
          date,
          label: labelFor(date),
          hours: dh,
          standardHours: dsh,
          varianceHours: round1(dsh - dh),
          jobs: d.jobs,
        };
      });
    return {
      mechanicId: r.mechanicId,
      name: r.name,
      hours,
      standardHours,
      varianceHours: round1(standardHours - hours),
      efficiencyPct: hours > 0 ? (standardHours / hours) * 100 : 0,
      inspections: r.inspections,
      repairs: r.repairs,
      jobsPerHour: hours > 0 ? jobs / hours : 0,
      minutesPerJob: jobs > 0 ? (hours * 60) / jobs : 0,
      days,
    };
  });
  perMechanic.sort((a, b) => b.efficiencyPct - a.efficiencyPct);

  const totalHours = daily.reduce((s, d) => s + d.hours, 0);
  const totalStandardHours = daily.reduce((s, d) => s + d.standardHours, 0);
  const totalInspections = daily.reduce((s, d) => s + d.inspections, 0);
  const totalRepairs = daily.reduce((s, d) => s + d.repairs, 0);
  const totalJobs = totalInspections + totalRepairs;

  return {
    daily,
    perMechanic,
    totals: {
      hours: round1(totalHours),
      standardHours: round1(totalStandardHours),
      varianceHours: round1(totalStandardHours - totalHours),
      efficiencyPct: totalHours > 0 ? (totalStandardHours / totalHours) * 100 : 0,
      inspections: totalInspections,
      repairs: totalRepairs,
      jobsPerHour: totalHours > 0 ? totalJobs / totalHours : 0,
      minutesPerJob: totalJobs > 0 ? (totalHours * 60) / totalJobs : 0,
      catalogueCoveragePct: totalRepairRows > 0 ? (catalogueRepairs / totalRepairRows) * 100 : 0,
    },
    settings: {
      hourlyRate,
      inspectionMinutes,
      defaultRepairMinutes,
    },
  };
}
