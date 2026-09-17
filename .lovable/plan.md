# Stop duplicate "Bike Collected" emails

## What the records show

Checked the last 24 hours of email records. The duplicated ones are all the collection set:

- "Bike Collected — CCC…" went out twice to the same person on 12 different jobs.
- The two copies are sent within the same second (e.g. 18:12:42.2 and 18:12:43.1), not hours apart.
- For jobs that need inspection, the same run also sends "Your bike is on the way to our service centre" and "Please confirm your delivery availability" — so a duplicated run produces up to six emails to one person instead of three. That is why the inspection jobs look worst.

Cause: Shipday sends its "collection completed" signal more than once (the logs show repeats for the same job), and the reconciliation sweep can raise the same event. There is a "already sent" check, but it is only written *after* all the emails have gone out. Two signals arriving in the same second both pass the check, so both send.

So no — it is not inspections only. Any collected bike can double up; inspection jobs simply carry two extra emails in the same batch.

## The fix

1. **Claim the job before sending.** Stamp the "collection confirmation sent" marker first, in a single write that only succeeds if it is still empty. Whichever signal wins does the sending; the other one sees the claim and stops. This closes the same-second gap.
2. **Release on total failure.** If every email in the batch fails (no sender, no receiver, provider down), clear the marker again so a later signal can retry — today's behaviour of not marking on failure is preserved.
3. **Guard the follow-up emails too.** The "on the way to our service centre" and "confirm your delivery availability" emails sit inside the same claimed block, so they can't double up either.

No customer-visible change other than one copy of each email.

## Technical notes

`supabase/functions/send-email/index.ts`, `handleCollectionConfirmation`:

- Replace the read-then-check with an atomic claim:
  `update orders set collection_confirmation_sent_at = now(), order_collected = true where id = :orderId and collection_confirmation_sent_at is null returning id`.
  Zero rows returned → respond `{ success: true, alreadySent: true }` and send nothing.
- Move the existing sender/receiver/service-centre/availability sends after the successful claim; drop the trailing update that currently sets the marker.
- If both `senderSent` and `receiverSent` are false at the end, reset `collection_confirmation_sent_at` to `null` (leave `order_collected` true, matching current semantics) so the next signal can retry.
- No schema change; `collection_confirmation_sent_at` and its index already exist.
- Callers (`shipday-webhook`, `reconcile-shipday-orders`) need no change — their pre-checks stay as a cheap first filter.
- Redeploy `send-email`.
