# API & Webhook Analytics

Add an **API & Webhooks** tab to the Analytics page covering both integration inbound traffic (customer API/Shopify order creation) and outbound webhook deliveries — plus new request-level logging so future API metrics are exact.

## What you'll see

**Top stat cards**
- API orders created (in the selected period) and share of all orders
- Active API keys / total keys, keys used in last 30 days, keys never used
- Webhook delivery success rate and total deliveries
- Average webhook delivery latency and average retry attempts

**Charts and tables**
- API orders over time (daily/weekly), split by source: API key vs Shopify
- API requests over time and success vs error rate (from the new log, once collecting)
- Endpoint breakdown: requests, error rate, average response time
- Per-customer API leaderboard: orders created, requests, last used, key name
- Webhook deliveries over time (success vs failed, stacked)
- Webhook event-type breakdown (which events fire most, and their failure rate)
- Endpoint health table: each configured webhook with success rate, average latency, last status, last error
- Recent failures table: event, endpoint, HTTP status, attempts, time — with the truncated error message

Existing period filter and date range on the Analytics page drive all of it.

## Request logging (new)

A small `api_request_logs` table written by the public `orders` API function on every call: endpoint, HTTP method, response status, duration, the API key id/user, and whether authentication succeeded. No request bodies or PII stored. Historical API metrics before today keep coming from `orders.created_via_api` / `shopify_order_id`, so the tab is useful immediately and gets sharper over time.

## Technical notes

- Migration: create `public.api_request_logs` (id, api_key_id nullable, user_id nullable, endpoint, method, status_code, duration_ms, success, error_code, created_at) with grants (`service_role` full, `authenticated` select), RLS enabled, admin-only select policy via `is_admin()` plus own-rows select for the key owner. Index on `created_at` and `user_id`.
- Edge function: in `supabase/functions/orders/index.ts`, wrap the handler so each response logs one row via the service-role client (fire-and-forget with `EdgeRuntime.waitUntil`), including auth failures. No behaviour or response changes.
- New `src/services/apiWebhookAnalyticsService.ts`: paginated fetches (`.range()` loops) for `webhook_delivery_logs`, `webhook_configurations`, `api_keys`, `api_request_logs`, and API-created orders; aggregation helpers for daily series, event/endpoint breakdowns, success rates, latency, and per-customer rollups. Server-side date filters to avoid the 1,000-row cap.
- New components under `src/components/analytics/`: `ApiWebhookStatsCards.tsx`, `ApiOrdersOverTimeChart.tsx`, `ApiEndpointTable.tsx`, `ApiCustomerLeaderboard.tsx`, `WebhookDeliveriesChart.tsx`, `WebhookEventBreakdownChart.tsx`, `WebhookEndpointHealthTable.tsx`, `WebhookFailuresTable.tsx`.
- `src/pages/AnalyticsPage.tsx`: add `api-webhooks` tab trigger and content, following existing mobile-safe patterns (`overflow-x-auto` wrappers, `ResponsiveContainer` inside a sized parent) so nothing overflows on small screens.
- Admin-only, matching current Analytics page access.
