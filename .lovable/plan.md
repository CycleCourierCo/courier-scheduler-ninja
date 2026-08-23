# Integration API Analytics

Add visibility into every conversation the system has with outside services: calls we send out (Shipday, WhatsApp, QuickBooks, email, Shopify, InspectaBike, address lookup, vehicle lookup, fuel data) and webhooks third parties send in to us.

This is separate from the existing "API & Webhooks" analytics section, which covers the customer-facing orders API and outbound customer webhooks. Those stay as they are.

## What gets recorded

Counts and health only — no request or response contents, no customer details.

Per call: provider (shipday, whatsapp, quickbooks, resend, shopify, inspectabike, geoapify, dvla, fuel), direction (outbound or inbound webhook), a short operation label (for example "create job", "send template", "create invoice", "status event"), the HTTP status, whether it succeeded, how long it took, and a short error label on failure. Nothing else.

History is kept for 30 days and older rows are cleared automatically each night.

## What the page shows

A new "Integrations" section on the Analytics page, admin-only, with a date range picker matching the rest of the page:

- Headline cards: total outbound calls, success rate, failures, median response time, total inbound webhooks received.
- Calls over time chart, stacked by provider, with a toggle to view failures only.
- Per-provider breakdown table: calls, successes, failures, failure rate, median and slowest response time, last call time. Red highlight when failure rate crosses 5 percent.
- Per-operation breakdown within each provider so a single misbehaving action stands out.
- Inbound webhook panel: received count per provider, rejected/unauthorised count, and last received time — useful for spotting a provider that has quietly stopped sending.
- Recent failures list: time, provider, operation, status, short error label.

## Technical notes

- New table `integration_call_logs` (provider, direction, operation, status_code, success, duration_ms, error_label, created_at) with an index on `created_at, provider`. Grants and row-level security so only staff roles can read; only the service role writes. A nightly scheduled cleanup deletes rows older than 30 days.
- New shared helper `supabase/functions/_shared/integrationLog.ts` exposing `logIntegrationCall(...)` and a `trackedFetch(provider, operation, url, init)` wrapper that times the call, records the outcome, and returns the response untouched. Writes are fire-and-forget via `EdgeRuntime.waitUntil` so no integration slows down or fails because logging failed.
- Instrument outbound calls by swapping the raw `fetch` for `trackedFetch` in the integration functions: Shipday (`create-shipday-order`, `delete-shipday-order`, `get-shipday-carriers`, `verify-shipday-orders`, `reconcile-shipday-orders`), WhatsApp (`send-sendzen-whatsapp`, `send-announcement-whatsapp`, `send-loading-list-whatsapp`, `cs-send-message`, `list-sendzen-templates`), QuickBooks (the shared invoice delivery helper plus the invoice, customer, oauth and token-refresh functions), Resend email (`send-email` and the shared senders), Shopify (`customer-shopify-connect`), InspectaBike (`inspectabike-create-job`, `inspectabike-push-status`), plus `lookup-vehicle`, `refresh-vehicles`, `fuel-finder`, and the address lookup used at order creation.
- Instrument inbound webhooks at the top of `shipday-webhook`, `shopify-webhook`, `customer-shopify-webhook`, `inspectabike-fault-webhook`, `resend-webhook`, `cs-inbound-email`, and `cs-inbound-whatsapp` — one row per request, recording whether it was accepted or rejected by the signature/token check.
- Frontend: `src/services/integrationAnalyticsService.ts` for aggregation, `src/components/analytics/IntegrationsSection.tsx` plus small chart/table components, mounted into `AnalyticsPage`. Server-side date filters and paging so the 1,000-row limit is not hit.
