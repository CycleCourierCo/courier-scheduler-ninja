# Stop failed collections being marked collected by a photo upload

## What happened on CCC754126989536RHYN11

On 8 Oct at 18:32, Abdul Samad failed the collection in Shipday and attached a photo. Shipday sent us two messages less than half a second apart:

1. "Photo uploaded". The system treated this as proof of collection and marked the job **Collected**.
2. "Failed". The system then put the job back to needing a collection.

The "Collected" step had already started the "we've collected your bike" email. That email went out a second after the failure, and sending it marked the bike as collected again. So the customer got a wrong "collected" email and the job showed as collected. Someone set it back by hand this morning, and it currently shows correctly as not collected.

## What will change

1. A photo upload on its own no longer counts as a collection or delivery. We first ask Shipday what actually happened to the job. If Shipday says it failed or wasn't completed, we just keep the photo on the tracking history.
2. If a failure is already recorded for that collection job, a photo upload arriving afterwards is ignored for status.
3. The "we've collected your bike" email checks the job is still really collected right before sending. If it has failed in the meantime, the email isn't sent.
4. Sending that email no longer marks the bike as collected. Only a real completed collection does that.

The same rules apply to the delivery confirmation email, so a failed delivery with a photo can't send a "delivered" email.

## Already affected jobs

- RHYN11 is already corrected. The wrong email can't be unsent. You may want to let the customer know.
- CCC754418388450FABDE6, from the earlier fix, still shows as Collected and on Mohammed's van. I'll reset it if you say yes. I'll also re-check for any others just before making changes.

## Technical details

- `supabase/functions/shipday-webhook/index.ts`, `ORDER_POD_UPLOAD` branch:
  - Fetch the canonical Shipday status using the same lookup the `ORDER_COMPLETED` stale guard uses.
  - Only map to `collected`/`delivered` when the canonical status is a completion.
  - If the latest stored event for this `orderId` is `ORDER_FAILED`, or the canonical status is `FAILED`/`INCOMPLETE`, keep `newStatus = dbOrder.status` and only append the photo event.
- `supabase/functions/send-email/index.ts`, `handleCollectionConfirmation`:
  - Remove `order_collected: true` from the claim update.
  - Add guards to the claim: `.eq('order_collected', true)` and status in collected/post-collection states.
  - Re-read the order and skip if the last pickup event is `ORDER_FAILED`.
  - Make the same status re-check in `handleDeliveryConfirmation`.
- `shipday-webhook`: set `order_collected = true` in the same update as the `collected` status, so the email guard sees it.
- `reconcile-shipday-orders`: emails already only fire on `ORDER_COMPLETED`, so no change is needed beyond the earlier fix.
- Redeploy `shipday-webhook` and `send-email`.
