# Split workshop updates: buyer gets the detail, seller gets "on its way"

Today, once a bike is collected and sitting with us, both sender and receiver get the same email ("Your bike is safely at our depot… our workshop is working through its inspection and any agreed work"). The seller doesn't need the workshop detail — they only care that the bike left them and is heading to the buyer.

## New behaviour

**Buyer (receiver)** gets the workshop-stage updates, worded to where the bike actually is:

| Stage | Message to buyer |
| --- | --- |
| Collected, awaiting inspection | "Your bike is safely at our depot and booked in for its inspection." |
| Inspected, no issues / awaiting cleaning | "Inspection done — no issues found. It's being cleaned and prepared for delivery." |
| Issues found, awaiting decision | "Our workshop found a few things worth doing — we'll be in touch about them." |
| Repairs approved / in repair | "The agreed work is underway in our workshop." |
| Service complete (repaired) | "Work and cleaning are complete — we're arranging your delivery now." |
| No inspection needed | "Your bike is at our depot being prepared for onward delivery." |

Plus the existing closing line about delivery dates (already-given dates vs. we'll be in touch).

**Seller (sender)** gets one simple, reassuring message instead of the workshop detail:

- Headline: "Your bike is on its way to the buyer"
- "Your bike has been collected and is safely with us on its way to {buyer first name / the buyer}."
- "We'll take it from here — there's nothing else you need to do."

No further workshop or delivery-scheduling chasers go to the seller at this stage; the seller still gets collection-side emails (dates request, collection booked, missed collection) exactly as now.

## Unchanged

- The 2-day quiet rule, test-account suppression, and cancelled/delivered skips.
- Box My Bike and Foam My Bike / Northern Ireland stage wording (both sides still notified there).
- Availability requests, collection and delivery booking confirmations, and delay apologies.

## Technical notes

- `supabase/functions/send-order-updates/index.ts`: replace the single `in_depot` block (both sides, same copy) with two branches — a receiver stage derived from `needs_inspection` plus the inspection row's stage (`pending`, `inspected`, `issues_found`, `awaiting_repair`/`in_repair`, `cleaning`, `repaired`), and a sender-only `sender_bike_on_way` update.
- The batch loop already fetches inspection completion per order; extend that fetch to carry each order's inspection `status` (not just complete/not) so the buyer copy can name the stage.
- New `stage_key` values (`in_depot_awaiting_inspection`, `in_depot_inspected`, `in_depot_issues_found`, `in_depot_in_repair`, `in_depot_service_complete`, `sender_bike_on_way`) added to the label map in `src/components/order-detail/CustomerUpdatesCard.tsx` so the admin panel reads plainly.
- Redeploy `send-order-updates`; no schema change.
