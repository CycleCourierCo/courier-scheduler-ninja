import { supabase } from "@/integrations/supabase/client";

export interface ApiWebhookRange {
  start: string; // ISO
  end: string; // ISO
}

export interface ApiRequestLogRow {
  id: string;
  user_id: string | null;
  endpoint: string;
  method: string;
  status_code: number;
  duration_ms: number | null;
  success: boolean;
  error_code: string | null;
  created_at: string;
}

export interface WebhookDeliveryRow {
  id: string;
  webhook_config_id: string | null;
  order_id: string | null;
  event_type: string;
  response_status: number | null;
  response_body: string | null;
  delivery_duration_ms: number | null;
  attempt_number: number | null;
  delivered_at: string;
  success: boolean;
}

export interface WebhookConfigRow {
  id: string;
  user_id: string;
  name: string;
  endpoint_url: string;
  is_active: boolean;
  events: string[] | null;
  last_triggered_at: string | null;
  last_delivery_status: string | null;
  last_error_message: string | null;
}

export interface ApiKeyRow {
  id: string;
  user_id: string;
  key_name: string;
  key_prefix: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface ApiOrderRow {
  id: string;
  user_id: string | null;
  created_at: string;
  created_via_api: boolean | null;
  shopify_order_id: string | null;
}

const PAGE = 1000;

async function fetchAllPages<T>(
  build: (from: number, to: number) => any,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // Bounded loop to avoid runaway paging
  for (let i = 0; i < 200; i++) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export const fetchApiRequestLogs = async (range?: ApiWebhookRange) =>
  fetchAllPages<ApiRequestLogRow>((from, to) => {
    let q = supabase
      .from("api_request_logs")
      .select("id,user_id,endpoint,method,status_code,duration_ms,success,error_code,created_at")
      .order("created_at", { ascending: true })
      .range(from, to);
    if (range) q = q.gte("created_at", range.start).lte("created_at", range.end);
    return q;
  });

export const fetchWebhookDeliveries = async (range?: ApiWebhookRange) =>
  fetchAllPages<WebhookDeliveryRow>((from, to) => {
    let q = supabase
      .from("webhook_delivery_logs")
      .select(
        "id,webhook_config_id,order_id,event_type,response_status,response_body,delivery_duration_ms,attempt_number,delivered_at,success",
      )
      .order("delivered_at", { ascending: true })
      .range(from, to);
    if (range) q = q.gte("delivered_at", range.start).lte("delivered_at", range.end);
    return q;
  });

export const fetchWebhookConfigs = async () =>
  fetchAllPages<WebhookConfigRow>((from, to) =>
    supabase
      .from("webhook_configurations")
      .select("id,user_id,name,endpoint_url,is_active,events,last_triggered_at,last_delivery_status,last_error_message")
      .order("created_at", { ascending: true })
      .range(from, to),
  );

export const fetchApiKeys = async () =>
  fetchAllPages<ApiKeyRow>((from, to) =>
    supabase
      .from("api_keys")
      .select("id,user_id,key_name,key_prefix,is_active,last_used_at,created_at")
      .order("created_at", { ascending: true })
      .range(from, to),
  );

export const fetchApiCreatedOrders = async (range?: ApiWebhookRange) =>
  fetchAllPages<ApiOrderRow>((from, to) => {
    let q = supabase
      .from("orders")
      .select("id,user_id,created_at,created_via_api,shopify_order_id")
      .or("created_via_api.eq.true,shopify_order_id.not.is.null")
      .order("created_at", { ascending: true })
      .range(from, to);
    if (range) q = q.gte("created_at", range.start).lte("created_at", range.end);
    return q;
  });

// ---------- aggregation helpers ----------

const dayKey = (iso: string) => iso.slice(0, 10);

const fmtDay = (key: string) =>
  new Date(key + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

export interface ApiOrdersPoint {
  day: string;
  label: string;
  api: number;
  shopify: number;
  total: number;
}

export const getApiOrdersOverTime = (rows: ApiOrderRow[]): ApiOrdersPoint[] => {
  const map = new Map<string, { api: number; shopify: number }>();
  for (const r of rows) {
    if (!r.created_at) continue;
    const key = dayKey(r.created_at);
    if (!map.has(key)) map.set(key, { api: 0, shopify: 0 });
    const e = map.get(key)!;
    if (r.shopify_order_id) e.shopify += 1;
    else e.api += 1;
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, label: fmtDay(day), api: v.api, shopify: v.shopify, total: v.api + v.shopify }));
};

export interface ApiRequestsPoint {
  day: string;
  label: string;
  success: number;
  failed: number;
}

export const getApiRequestsOverTime = (rows: ApiRequestLogRow[]): ApiRequestsPoint[] => {
  const map = new Map<string, { success: number; failed: number }>();
  for (const r of rows) {
    const key = dayKey(r.created_at);
    if (!map.has(key)) map.set(key, { success: 0, failed: 0 });
    const e = map.get(key)!;
    if (r.success) e.success += 1;
    else e.failed += 1;
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, label: fmtDay(day), ...v }));
};

export interface EndpointStatRow {
  endpoint: string;
  method: string;
  requests: number;
  errors: number;
  errorRate: number;
  avgDurationMs: number;
  topError: string | null;
}

export const getApiEndpointStats = (rows: ApiRequestLogRow[]): EndpointStatRow[] => {
  const map = new Map<
    string,
    { endpoint: string; method: string; requests: number; errors: number; duration: number; codes: Record<string, number> }
  >();
  for (const r of rows) {
    const key = `${r.method} ${r.endpoint}`;
    if (!map.has(key)) {
      map.set(key, { endpoint: r.endpoint, method: r.method, requests: 0, errors: 0, duration: 0, codes: {} });
    }
    const e = map.get(key)!;
    e.requests += 1;
    e.duration += Number(r.duration_ms) || 0;
    if (!r.success) {
      e.errors += 1;
      const code = r.error_code || String(r.status_code);
      e.codes[code] = (e.codes[code] || 0) + 1;
    }
  }
  return Array.from(map.values())
    .map((e) => ({
      endpoint: e.endpoint,
      method: e.method,
      requests: e.requests,
      errors: e.errors,
      errorRate: e.requests ? Math.round((e.errors / e.requests) * 1000) / 10 : 0,
      avgDurationMs: e.requests ? Math.round(e.duration / e.requests) : 0,
      topError:
        Object.entries(e.codes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.requests - a.requests);
};

export interface ApiCustomerRow {
  userId: string;
  customer: string;
  keyNames: string;
  orders: number;
  requests: number;
  errors: number;
  lastUsedAt: string | null;
}

export const getApiCustomerLeaderboard = (
  orders: ApiOrderRow[],
  logs: ApiRequestLogRow[],
  keys: ApiKeyRow[],
  nameLookup: Record<string, string>,
): ApiCustomerRow[] => {
  const ids = new Set<string>();
  orders.forEach((o) => o.user_id && ids.add(o.user_id));
  logs.forEach((l) => l.user_id && ids.add(l.user_id));
  keys.forEach((k) => ids.add(k.user_id));

  return Array.from(ids)
    .map((userId) => {
      const userKeys = keys.filter((k) => k.user_id === userId);
      const userLogs = logs.filter((l) => l.user_id === userId);
      const lastUsed = userKeys
        .map((k) => k.last_used_at)
        .filter(Boolean)
        .sort()
        .pop() ?? null;
      return {
        userId,
        customer: nameLookup[userId] ?? "Unknown customer",
        keyNames: userKeys.map((k) => k.key_name).join(", ") || "—",
        orders: orders.filter((o) => o.user_id === userId).length,
        requests: userLogs.length,
        errors: userLogs.filter((l) => !l.success).length,
        lastUsedAt: lastUsed,
      };
    })
    .sort((a, b) => b.orders - a.orders || b.requests - a.requests);
};

export interface WebhookDeliveryPoint {
  day: string;
  label: string;
  success: number;
  failed: number;
}

export const getWebhookDeliveriesOverTime = (rows: WebhookDeliveryRow[]): WebhookDeliveryPoint[] => {
  const map = new Map<string, { success: number; failed: number }>();
  for (const r of rows) {
    if (!r.delivered_at) continue;
    const key = dayKey(r.delivered_at);
    if (!map.has(key)) map.set(key, { success: 0, failed: 0 });
    const e = map.get(key)!;
    if (r.success) e.success += 1;
    else e.failed += 1;
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, label: fmtDay(day), ...v }));
};

export interface WebhookEventRow {
  event: string;
  total: number;
  failed: number;
  failureRate: number;
}

export const getWebhookEventBreakdown = (rows: WebhookDeliveryRow[]): WebhookEventRow[] => {
  const map = new Map<string, { total: number; failed: number }>();
  for (const r of rows) {
    const key = r.event_type || "unknown";
    if (!map.has(key)) map.set(key, { total: 0, failed: 0 });
    const e = map.get(key)!;
    e.total += 1;
    if (!r.success) e.failed += 1;
  }
  return Array.from(map.entries())
    .map(([event, v]) => ({
      event,
      total: v.total,
      failed: v.failed,
      failureRate: v.total ? Math.round((v.failed / v.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);
};

export interface WebhookEndpointHealthRow {
  configId: string;
  name: string;
  endpointUrl: string;
  isActive: boolean;
  customer: string;
  deliveries: number;
  successRate: number;
  avgDurationMs: number;
  avgAttempts: number;
  lastTriggeredAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
}

export const getWebhookEndpointHealth = (
  configs: WebhookConfigRow[],
  rows: WebhookDeliveryRow[],
  nameLookup: Record<string, string>,
): WebhookEndpointHealthRow[] =>
  configs
    .map((c) => {
      const logs = rows.filter((r) => r.webhook_config_id === c.id);
      const ok = logs.filter((r) => r.success).length;
      return {
        configId: c.id,
        name: c.name,
        endpointUrl: c.endpoint_url,
        isActive: c.is_active,
        customer: nameLookup[c.user_id] ?? "Unknown customer",
        deliveries: logs.length,
        successRate: logs.length ? Math.round((ok / logs.length) * 1000) / 10 : 0,
        avgDurationMs: logs.length
          ? Math.round(logs.reduce((s, r) => s + (Number(r.delivery_duration_ms) || 0), 0) / logs.length)
          : 0,
        avgAttempts: logs.length
          ? Math.round((logs.reduce((s, r) => s + (Number(r.attempt_number) || 1), 0) / logs.length) * 10) / 10
          : 0,
        lastTriggeredAt: c.last_triggered_at,
        lastStatus: c.last_delivery_status,
        lastError: c.last_error_message,
      };
    })
    .sort((a, b) => b.deliveries - a.deliveries);

export interface WebhookFailureRow {
  id: string;
  event: string;
  endpointName: string;
  status: number | null;
  attempts: number | null;
  deliveredAt: string;
  error: string | null;
}

export const getRecentWebhookFailures = (
  rows: WebhookDeliveryRow[],
  configs: WebhookConfigRow[],
  limit = 25,
): WebhookFailureRow[] => {
  const nameById = Object.fromEntries(configs.map((c) => [c.id, c.name]));
  return rows
    .filter((r) => !r.success)
    .sort((a, b) => (b.delivered_at || "").localeCompare(a.delivered_at || ""))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      event: r.event_type || "unknown",
      endpointName: (r.webhook_config_id && nameById[r.webhook_config_id]) || "Unknown endpoint",
      status: r.response_status,
      attempts: r.attempt_number,
      deliveredAt: r.delivered_at,
      error: r.response_body ? r.response_body.slice(0, 180) : null,
    }));
};

export interface ApiWebhookTotals {
  apiOrders: number;
  apiOrdersShare: number;
  shopifyOrders: number;
  totalKeys: number;
  activeKeys: number;
  keysUsedLast30: number;
  keysNeverUsed: number;
  requests: number;
  requestSuccessRate: number;
  avgRequestMs: number;
  deliveries: number;
  deliverySuccessRate: number;
  avgDeliveryMs: number;
  avgAttempts: number;
  activeEndpoints: number;
}

export const getApiWebhookTotals = (
  apiOrders: ApiOrderRow[],
  totalOrdersInPeriod: number,
  logs: ApiRequestLogRow[],
  keys: ApiKeyRow[],
  deliveries: WebhookDeliveryRow[],
  configs: WebhookConfigRow[],
): ApiWebhookTotals => {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const okDeliveries = deliveries.filter((d) => d.success).length;
  const okRequests = logs.filter((l) => l.success).length;
  const shopifyOrders = apiOrders.filter((o) => o.shopify_order_id).length;

  return {
    apiOrders: apiOrders.length,
    apiOrdersShare: totalOrdersInPeriod
      ? Math.round((apiOrders.length / totalOrdersInPeriod) * 1000) / 10
      : 0,
    shopifyOrders,
    totalKeys: keys.length,
    activeKeys: keys.filter((k) => k.is_active).length,
    keysUsedLast30: keys.filter((k) => k.last_used_at && new Date(k.last_used_at).getTime() >= thirtyDaysAgo).length,
    keysNeverUsed: keys.filter((k) => !k.last_used_at).length,
    requests: logs.length,
    requestSuccessRate: logs.length ? Math.round((okRequests / logs.length) * 1000) / 10 : 0,
    avgRequestMs: logs.length
      ? Math.round(logs.reduce((s, l) => s + (Number(l.duration_ms) || 0), 0) / logs.length)
      : 0,
    deliveries: deliveries.length,
    deliverySuccessRate: deliveries.length ? Math.round((okDeliveries / deliveries.length) * 1000) / 10 : 0,
    avgDeliveryMs: deliveries.length
      ? Math.round(deliveries.reduce((s, d) => s + (Number(d.delivery_duration_ms) || 0), 0) / deliveries.length)
      : 0,
    avgAttempts: deliveries.length
      ? Math.round((deliveries.reduce((s, d) => s + (Number(d.attempt_number) || 1), 0) / deliveries.length) * 10) / 10
      : 0,
    activeEndpoints: configs.filter((c) => c.is_active).length,
  };
};
