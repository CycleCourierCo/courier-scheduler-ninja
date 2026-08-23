import { supabase } from "@/integrations/supabase/client";

export interface IntegrationRange {
  start: string; // ISO
  end: string; // ISO
}

export interface IntegrationCallLogRow {
  id: string;
  provider: string;
  operation: string;
  direction: string;
  status_code: number | null;
  success: boolean;
  duration_ms: number | null;
  error_label: string | null;
  created_at: string;
}

const PAGE_SIZE = 1000;

/** Fetches integration call logs, paginating past the 1,000-row limit. */
export const fetchIntegrationCallLogs = async (
  range?: IntegrationRange,
): Promise<IntegrationCallLogRow[]> => {
  const rows: IntegrationCallLogRow[] = [];
  let from = 0;

  // Hard safety cap so a busy window can never spin forever.
  for (let page = 0; page < 40; page++) {
    let query = supabase
      .from("integration_call_logs")
      .select("id, provider, operation, direction, status_code, success, duration_ms, error_label, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (range) {
      query = query.gte("created_at", range.start).lte("created_at", range.end);
    }

    const { data, error } = await query;
    if (error) throw error;
    const batch = (data ?? []) as IntegrationCallLogRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
};

export interface IntegrationTotals {
  total: number;
  outbound: number;
  inbound: number;
  failures: number;
  successRate: number; // 0-100
  avgDurationMs: number | null;
  p95DurationMs: number | null;
}

export const getIntegrationTotals = (rows: IntegrationCallLogRow[]): IntegrationTotals => {
  const total = rows.length;
  const failures = rows.filter((r) => !r.success).length;
  const durations = rows
    .map((r) => r.duration_ms)
    .filter((d): d is number => typeof d === "number" && d >= 0)
    .sort((a, b) => a - b);

  const avg = durations.length
    ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
    : null;
  const p95 = durations.length
    ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]
    : null;

  return {
    total,
    outbound: rows.filter((r) => r.direction === "outbound").length,
    inbound: rows.filter((r) => r.direction === "inbound").length,
    failures,
    successRate: total ? ((total - failures) / total) * 100 : 100,
    avgDurationMs: avg,
    p95DurationMs: p95,
  };
};

export interface ProviderStat {
  provider: string;
  total: number;
  failures: number;
  successRate: number;
  avgDurationMs: number | null;
  outbound: number;
  inbound: number;
  lastCallAt: string | null;
}

export const getProviderStats = (rows: IntegrationCallLogRow[]): ProviderStat[] => {
  const map = new Map<string, IntegrationCallLogRow[]>();
  rows.forEach((r) => {
    const list = map.get(r.provider) ?? [];
    list.push(r);
    map.set(r.provider, list);
  });

  return Array.from(map.entries())
    .map(([provider, list]) => {
      const failures = list.filter((r) => !r.success).length;
      const durations = list
        .map((r) => r.duration_ms)
        .filter((d): d is number => typeof d === "number" && d >= 0);
      const last = list.reduce<string | null>(
        (acc, r) => (!acc || r.created_at > acc ? r.created_at : acc),
        null,
      );
      return {
        provider,
        total: list.length,
        failures,
        successRate: list.length ? ((list.length - failures) / list.length) * 100 : 100,
        avgDurationMs: durations.length
          ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
          : null,
        outbound: list.filter((r) => r.direction === "outbound").length,
        inbound: list.filter((r) => r.direction === "inbound").length,
        lastCallAt: last,
      };
    })
    .sort((a, b) => b.total - a.total);
};

export interface OperationStat {
  provider: string;
  operation: string;
  total: number;
  failures: number;
  successRate: number;
  avgDurationMs: number | null;
}

export const getOperationStats = (rows: IntegrationCallLogRow[]): OperationStat[] => {
  const map = new Map<string, IntegrationCallLogRow[]>();
  rows.forEach((r) => {
    const key = `${r.provider}||${r.operation}`;
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  });

  return Array.from(map.entries())
    .map(([key, list]) => {
      const [provider, operation] = key.split("||");
      const failures = list.filter((r) => !r.success).length;
      const durations = list
        .map((r) => r.duration_ms)
        .filter((d): d is number => typeof d === "number" && d >= 0);
      return {
        provider,
        operation,
        total: list.length,
        failures,
        successRate: list.length ? ((list.length - failures) / list.length) * 100 : 100,
        avgDurationMs: durations.length
          ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
          : null,
      };
    })
    .sort((a, b) => b.total - a.total);
};

export interface IntegrationTrendPoint {
  date: string; // YYYY-MM-DD
  total: number;
  failures: number;
  outbound: number;
  inbound: number;
}

export const getIntegrationCallsOverTime = (
  rows: IntegrationCallLogRow[],
): IntegrationTrendPoint[] => {
  const map = new Map<string, IntegrationTrendPoint>();
  rows.forEach((r) => {
    const date = r.created_at.slice(0, 10);
    const point =
      map.get(date) ?? { date, total: 0, failures: 0, outbound: 0, inbound: 0 };
    point.total += 1;
    if (!r.success) point.failures += 1;
    if (r.direction === "inbound") point.inbound += 1;
    else point.outbound += 1;
    map.set(date, point);
  });

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export interface IntegrationFailureRow {
  id: string;
  provider: string;
  operation: string;
  direction: string;
  statusCode: number | null;
  errorLabel: string | null;
  createdAt: string;
}

export const getRecentIntegrationFailures = (
  rows: IntegrationCallLogRow[],
  limit = 20,
): IntegrationFailureRow[] =>
  rows
    .filter((r) => !r.success)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      provider: r.provider,
      operation: r.operation,
      direction: r.direction,
      statusCode: r.status_code,
      errorLabel: r.error_label,
      createdAt: r.created_at,
    }));
