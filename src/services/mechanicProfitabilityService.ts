import { supabase } from '@/integrations/supabase/client';

export const INSPECTION_REVENUE = 60;

export interface MechanicProfitRow {
  mechanicId: string;
  mechanicName: string;
  inspectionsDone: number;
  inspectionRevenue: number;
  repairsDone: number;
  repairRevenue: number;
  labourRevenue: number;
  totalRevenue: number;
  hoursWorked: number;
  wageCost: number;
  profit: number;
  labourProfit: number;
  margin: number;
}

/**
 * Fetch mechanic profitability aggregated per mechanic between two dates (inclusive).
 * - Inspection revenue: £60 per bicycle_inspections row where inspected_at falls in range
 *   AND (status IN ('awaiting_pricing','issues_found','awaiting_parts','awaiting_repair','repaired','inspected')).
 *   Attributed to inspected_by_id.
 * - Repair revenue: sum of estimated_cost on inspection_issues where status IN ('resolved','repaired')
 *   AND resolved_at falls in range. Attributed to resolved_by_id.
 * - Wage cost: sum of total_pay on mechanic_timeslips where date in range and status IN ('closed','approved').
 */
export async function getMechanicProfitability(fromISO: string, toISO: string): Promise<MechanicProfitRow[]> {
  // 1. Inspections in range
  const { data: inspections, error: insErr } = await supabase
    .from('bicycle_inspections')
    .select('id, inspected_at, inspected_by_id, inspected_by_name, status')
    .not('inspected_by_id', 'is', null)
    .not('inspected_at', 'is', null)
    .gte('inspected_at', fromISO)
    .lte('inspected_at', toISO);
  if (insErr) throw insErr;

  // 2. Resolved issues in range
  const { data: issues, error: issErr } = await supabase
    .from('inspection_issues')
    .select('id, resolved_at, resolved_by_id, resolved_by_name, estimated_cost, parts_cost, labour_cost, status')
    .in('status', ['resolved', 'repaired'])
    .not('resolved_by_id', 'is', null)
    .not('resolved_at', 'is', null)
    .gte('resolved_at', fromISO)
    .lte('resolved_at', toISO);
  if (issErr) throw issErr;

  // 3. Mechanic timeslips in range
  const dateFrom = fromISO.slice(0, 10);
  const dateTo = toISO.slice(0, 10);
  const { data: slips, error: slipErr } = await supabase
    .from('mechanic_timeslips')
    .select('driver_id, total_hours, total_pay, status, date, driver:profiles!mechanic_timeslips_driver_id_fkey(id,name,email)')
    .in('status', ['closed', 'approved'])
    .gte('date', dateFrom)
    .lte('date', dateTo);
  if (slipErr) throw slipErr;

  const map = new Map<string, MechanicProfitRow>();
  const ensure = (id: string, name: string | null | undefined): MechanicProfitRow => {
    let row = map.get(id);
    if (!row) {
      row = {
        mechanicId: id,
        mechanicName: name || 'Unknown mechanic',
        inspectionsDone: 0,
        inspectionRevenue: 0,
        repairsDone: 0,
        repairRevenue: 0,
        labourRevenue: 0,
        totalRevenue: 0,
        hoursWorked: 0,
        wageCost: 0,
        profit: 0,
        labourProfit: 0,
        margin: 0,
      };
      map.set(id, row);
    } else if (!row.mechanicName || row.mechanicName === 'Unknown mechanic') {
      if (name) row.mechanicName = name;
    }
    return row;
  };

  (inspections || []).forEach((i: any) => {
    const row = ensure(i.inspected_by_id, i.inspected_by_name);
    row.inspectionsDone += 1;
    row.inspectionRevenue += INSPECTION_REVENUE;
    // Inspections are pure labour, so they count towards labour revenue too
    row.labourRevenue += INSPECTION_REVENUE;
  });

  (issues || []).forEach((iss: any) => {
    const row = ensure(iss.resolved_by_id, iss.resolved_by_name);
    row.repairsDone += 1;
    row.repairRevenue += Number(iss.estimated_cost || 0);
    if (iss.labour_cost != null) {
      row.labourRevenue += Number(iss.labour_cost || 0);
    }
  });

  (slips || []).forEach((s: any) => {
    const name = s.driver?.name || s.driver?.email || null;
    const row = ensure(s.driver_id, name);
    row.hoursWorked += Number(s.total_hours || 0);
    row.wageCost += Number(s.total_pay || 0);
  });

  const rows = Array.from(map.values()).map((r) => {
    r.totalRevenue = r.inspectionRevenue + r.repairRevenue;
    r.profit = r.totalRevenue - r.wageCost;
    r.labourProfit = r.labourRevenue - r.wageCost;
    r.margin = r.totalRevenue > 0 ? (r.profit / r.totalRevenue) * 100 : 0;
    return r;
  });

  rows.sort((a, b) => b.profit - a.profit);
  return rows;
}
