## Goal

Recover from the ~24h gap of 401-rejected Shipday webhooks by pulling the current state of every order Shipday touched in the last 24h and applying the same status mapping the webhook would have, so DB state catches up without waiting for new events.

## Why not just re-read logs

Supabase edge logs only record `POST | 401 | <url>` — the Shipday payload (orderId, event) is not captured. We can't extract which orders failed from logs alone, so we reconcile by polling Shipday instead.

## New edge function: `reconcile-shipday-orders`

Admin-only one-off (kept for future use). Triggered from an admin button or via curl. JWT-checked + role = `admin`.

### Input
```json
{ "hours": 24 }      // optional, default 24
```

### Flow

1. **Auth**: verify caller JWT and `has_role(uid, 'admin')`. Reject otherwise.
2. **Pull active orders from Shipday**: `GET https://api.shipday.com/orders` (Basic `SHIPDAY_API_KEY`). This returns currently active orders — same call `verify-shipday-orders` uses.
3. **Pull recently completed orders from Shipday**: paginated `POST https://api.shipday.com/orders/query` with `orderStatus: ALREADY_DELIVERED`, `startTime = now-24h`, `endTime = now` (same shape as `query-shipday-completed-orders`). Also query `INCOMPLETE` (failed) in the same window.
4. **Build a working set** of `{ shipdayOrderId, status, podUrls?, signatureUrl?, driverName?, activityLog? }` keyed by `orderId`.
5. **Match to local orders**: for each Shipday `orderId`, find the local order via `shipday_pickup_id = id` (pickup leg) OR `shipday_delivery_id = id` (delivery leg). Skip if no match.
6. **Derive event + leg** from the Shipday status using the same mapping the webhook uses:
   - `ACTIVE` / `ASSIGNED` → ASSIGNED (no status change, record driver)
   - `STARTED` → ORDER_ONTHEWAY → `driver_to_collection` or `driver_to_delivery`
   - `ALREADY_DELIVERED` → ORDER_COMPLETED → `collected` (pickup) or `delivered` (delivery), set `order_collected` / `order_delivered`
   - `FAILED_DELIVERY` → ORDER_FAILED → revert to scheduling status, clear shipday id + scheduled date for that leg (reuses webhook's `computeRevert` logic — copy/factor into `_shared/shipdayStatusMap.ts` so both call sites stay in sync)
7. **Dedupe against existing tracking_events**: skip if `tracking_events.shipday.updates[]` already contains an entry for `{ orderId, event }` (so re-running is idempotent and we don't double-fire emails).
8. **Apply update** with a single `UPDATE orders SET status=…, order_collected=…, order_delivered=…, tracking_events = jsonb_set(...)` per order, exactly mirroring the webhook's write path. Skip post-update side effects that the webhook normally triggers (collection/delivery confirmation emails) by default — see "Emails" below.
9. **Return summary**: `{ scanned, matched, updated, skipped_already_synced, skipped_no_local_match, errors[] }` so the admin sees exactly what was healed.

### Emails

Confirmation emails (`collection_confirmation_sent_at` / `delivery_confirmation_sent_at`) are normally sent inside the webhook on transition to `collected` / `delivered`. To avoid spamming customers a day late, the reconcile function will:

- Set `order_collected` / `order_delivered` and status.
- **Not** call the email senders.
- Set `collection_confirmation_sent_at` / `delivery_confirmation_sent_at` to `now()` so the next legitimate trigger doesn't re-send.

(If you'd rather have the emails go out, we can flip a `{ sendEmails: true }` flag at invocation time.)

### Trigger UI

Add a small "Reconcile Shipday (last 24h)" admin button on the existing Shipday/admin diagnostics page (or wherever feels right — happy to put it on the order list header for admins only). Invokes the function via `supabase.functions.invoke('reconcile-shipday-orders', { body: { hours: 24 } })` and toasts the summary.

### Files

- `supabase/functions/reconcile-shipday-orders/index.ts` — new
- `supabase/functions/_shared/shipdayStatusMap.ts` — extracted mapping shared with `shipday-webhook` (small refactor of the existing function to import from here, no behaviour change)
- One UI button + handler (location TBD — confirm in the next step)

### Out of scope

- No DB migration.
- No change to the webhook auth fix (already deployed).
- No cron — one-off invocation only, per your choice.
