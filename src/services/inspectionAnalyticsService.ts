import { supabase } from "@/integrations/supabase/client";

export interface InspectionAnalyticsRecord {
  id: string;
  created_at: string;
  status: string;
  inspection_issues: Array<{
    id: string;
    status: string;
    estimated_cost: number | null;
    customer_response: string | null;
    customer_responded_at: string | null;
  }>;
}

export const fetchInspectionsForAnalytics = async (): Promise<InspectionAnalyticsRecord[]> => {
  const all: InspectionAnalyticsRecord[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("bicycle_inspections")
      .select("id, created_at, status, inspection_issues(id, status, estimated_cost, customer_response, customer_responded_at)")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Error fetching inspections analytics:", error);
      throw error;
    }
    if (data && data.length > 0) {
      all.push(...(data as any));
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }
  return all;
};

export const getInspectionsOverTime = (
  inspections: InspectionAnalyticsRecord[]
): { month: string; label: string; count: number }[] => {
  const map: Record<string, number> = {};
  inspections.forEach(i => {
    const d = new Date(i.created_at);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map)
    .map(([month, count]) => {
      const [y, m] = month.split('-');
      const date = new Date(Number(y), Number(m) - 1, 1);
      const label = date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      return { month, label, count };
    })
    .sort((a, b) => a.month.localeCompare(b.month));
};

export const getInspectionsWithIssuesRate = (inspections: InspectionAnalyticsRecord[]) => {
  const total = inspections.length;
  const withIssues = inspections.filter(i => (i.inspection_issues || []).length > 0).length;
  const withoutIssues = total - withIssues;
  const percentage = total > 0 ? (withIssues / total) * 100 : 0;
  return { withIssues, withoutIssues, total, percentage };
};

const APPROVED_STATUSES = new Set(['approved', 'resolved', 'repaired']);

export const getAverageRepairCost = (inspections: InspectionAnalyticsRecord[]) => {
  const totals: number[] = [];
  inspections.forEach(i => {
    const issues = i.inspection_issues || [];
    if (issues.length === 0) return;
    const sum = issues
      .filter(iss => APPROVED_STATUSES.has(iss.status) && iss.estimated_cost != null)
      .reduce((s, iss) => s + Number(iss.estimated_cost || 0), 0);
    if (sum > 0) totals.push(sum);
  });
  const average = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  return { average, sampleSize: totals.length };
};

export const getIssueApprovalRate = (inspections: InspectionAnalyticsRecord[]) => {
  let approved = 0;
  let declined = 0;
  inspections.forEach(i => {
    (i.inspection_issues || []).forEach(iss => {
      if (APPROVED_STATUSES.has(iss.status)) approved++;
      else if (iss.status === 'declined') declined++;
    });
  });
  const responded = approved + declined;
  const percentage = responded > 0 ? (approved / responded) * 100 : 0;
  return { approved, declined, responded, percentage };
};
