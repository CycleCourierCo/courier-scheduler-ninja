# Why no webhook was sent for CCC754507545377MICB13

## What I found
- The order belongs to Broximo Prestige Steeds and came in through the API on 1 Oct 2026.
- Broximo has one webhook, "VDMS - BROXIMO", pointing to VeloDealer. It is switched **off**, and has been since 19 Sep 2026, before this order was created. Switched-off webhooks don't send anything, so no events went out for this order.
- Even when it was on, VeloDealer often replied "Collection not found" (error 404) to our updates. It didn't recognise the orders we sent, so those updates were rejected.

## Proposed fix
1. Switch the "VDMS - BROXIMO" webhook back on, after you confirm with VeloDealer that it should be on. Someone may have turned it off on purpose because of the 404 errors.
2. Resend the latest status ("delivered") for CCC754507545377MICB13 and any other Broximo orders created while the webhook was off. I'll list those orders before sending anything.
3. Tell VeloDealer about the "Collection not found" replies so they can match our orders on their side.

## Technical details
- `webhook_configurations` id b09a7079…, `is_active = false`, `updated_at` 2026-09-19 16:43 UTC.
- No `webhook_delivery_logs` rows exist for this order.
- To turn it back on: update `is_active = true`, then send the events again through `trigger-webhook` for the affected order ids.
