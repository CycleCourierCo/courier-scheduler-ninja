import { supabase } from "@/integrations/supabase/client";

export interface InspectionAnalyticsIssue {
  id: string;
  status: string;
  estimated_cost: number | null;
  customer_response: string | null;
  customer_responded_at: string | null;
  priced_at: string | null;
  parts_ordered_at: string | null;
  parts_arrived_at: string | null;
  resolved_at: string | null;
  created_at: string | null;
}

export interface InspectionAnalyticsRecord {
  id: string;
  created_at: string;
  status: string;
  inspected_at: string | null;
  order_id: string;
  orders?: {
    id: string;
    order_collected: boolean | null;
    scheduled_pickup_date: string | null;
    tracking_events: any;
  } | null;
  inspection_issues: InspectionAnalyticsIssue[];
}

export const fetchInspectionsForAnalytics = async (): Promise<InspectionAnalyticsRecord[]> => {
  const all: InspectionAnalyticsRecord[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("bicycle_inspections")
      .select(
        "id, created_at, status, inspected_at, order_id, " +
          "orders:order_id(id, order_collected, scheduled_pickup_date, tracking_events), " +
          "inspection_issues(id, status, estimated_cost, customer_response, customer_responded_at, priced_at, parts_ordered_at, parts_arrived_at, resolved_at, created_at)"
      )
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

// ---------- Stage durations ----------

export interface StageDuration {
  key: string;
  stage: string;
  avgHours: number;
  medianHours: number;
  sampleSize: number;
}

const HOUR_MS = 1000 * 60 * 60;

const diffHours = (from: string | null | undefined, to: string | null | undefined): number | null => {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  const h = (b - a) / HOUR_MS;
  if (h < 0) return null;
  return h;
};

const summarize = (values: number[]) => {
  if (values.length === 0) return { avgHours: 0, medianHours: 0, sampleSize: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return { avgHours: avg, medianHours: median, sampleSize: values.length };
};

// Extract a collection timestamp from the order: prefer a tracking event
// indicating collection, fall back to scheduled_pickup_date when the order
// is flagged as collected.
const getCollectionTimestamp = (order: InspectionAnalyticsRecord["orders"]): string | null => {
  if (!order) return null;
  const events = Array.isArray(order.tracking_events) ? order.tracking_events : [];
  // look for events whose status / type / description mentions "collect"
  const collectEvents = events
    .filter((e: any) => {
      const blob = `${e?.status ?? ''} ${e?.type ?? ''} ${e?.description ?? ''} ${e?.event ?? ''}`.toLowerCase();
      return blob.includes('collect') || blob.includes('picked up') || blob.includes('pickup_complete');
    })
    .map((e: any) => e?.timestamp || e?.created_at || e?.time || e?.date)
    .filter(Boolean) as string[];
  if (collectEvents.length > 0) {
    // earliest collection event
    return collectEvents.sort()[0];
  }
  if (order.order_collected && order.scheduled_pickup_date) return order.scheduled_pickup_date;
  return null;
};

export const getInspectionStageDurations = (
  inspections: InspectionAnalyticsRecord[]
): StageDuration[] => {
  const buckets: Record<string, number[]> = {
    collected_to_inspection: [],
    inspection_to_pricing: [],
    pricing_to_issues: [],
    issues_to_parts: [],
    parts_to_repair: [],
    repair_to_repaired: [],
  };

  inspections.forEach(insp => {
    const collectedAt = getCollectionTimestamp(insp.orders);
    const inspectedAt = insp.inspected_at;
    const issues = insp.inspection_issues || [];

    // 1. Collected → Inspection
    const d1 = diffHours(collectedAt, inspectedAt);
    if (d1 !== null) buckets.collected_to_inspection.push(d1);

    if (issues.length === 0) return;

    const earliest = (vals: (string | null)[]) =>
      vals.filter(Boolean).sort()[0] as string | undefined;

    const firstPriced = earliest(issues.map(i => i.priced_at));
    const firstResponded = earliest(issues.map(i => i.customer_responded_at));
    const firstPartsOrdered = earliest(issues.map(i => i.parts_ordered_at));
    const firstPartsArrived = earliest(issues.map(i => i.parts_arrived_at));
    const lastResolved = issues
      .map(i => i.resolved_at)
      .filter(Boolean)
      .sort()
      .slice(-1)[0];

    // 2. Inspection → Pricing
    const d2 = diffHours(inspectedAt, firstPriced ?? null);
    if (d2 !== null) buckets.inspection_to_pricing.push(d2);

    // 3. Pricing → Issues (customer response)
    const d3 = diffHours(firstPriced ?? null, firstResponded ?? null);
    if (d3 !== null) buckets.pricing_to_issues.push(d3);

    // 4. Issues → Waiting for parts
    const d4 = diffHours(firstResponded ?? null, firstPartsOrdered ?? null);
    if (d4 !== null) buckets.issues_to_parts.push(d4);

    // 5. Waiting for parts → Awaiting repair (parts arrived)
    const d5 = diffHours(firstPartsOrdered ?? null, firstPartsArrived ?? null);
    if (d5 !== null) buckets.parts_to_repair.push(d5);

    // 6. Awaiting repair → Repaired
    const repairStart = firstPartsArrived ?? firstResponded;
    const d6 = diffHours(repairStart ?? null, lastResolved ?? null);
    if (d6 !== null) buckets.repair_to_repaired.push(d6);
  });

  const labels: Record<string, string> = {
    collected_to_inspection: "Collected → Inspection",
    inspection_to_pricing: "Inspection → Pricing",
    pricing_to_issues: "Pricing → Customer Response",
    issues_to_parts: "Response → Parts Ordered",
    parts_to_repair: "Parts Ordered → Parts Arrived",
    repair_to_repaired: "Awaiting Repair → Repaired",
  };

  return Object.entries(buckets).map(([key, vals]) => ({
    key,
    stage: labels[key],
    ...summarize(vals),
  }));
};
