# Add "what happens next" to the proactive update emails

## Current state

- Milestone emails (dates confirmed, bike collected, on the way to service centre) already include a numbered "This is what happens next" list.
- The proactive update emails (`send-order-updates`) do not — they show the current stage, a headline and a "Typical time frames" note, but never say what happens next.

## Change

In `supabase/functions/send-order-updates/index.ts`, add a short "What happens next" section to every proactive update email, tailored to the stage:

| Stage | Next step shown |
| --- | --- |
| Booking received / waiting for collection dates | "Once you choose your dates, we'll build a route and send your time slot the day before collection." |
| Waiting for delivery dates | "Once dates are chosen, we'll arrange delivery and send the time slot the day before." |
| Dates received, planning route | "We'll send your time slot the day before we're due with you — there's nothing else you need to do." (No separate date confirmation is promised; the timeslot is the next contact.) |
| Collection booked (sender + receiver) | "You'll get your time slot the day before; after collection we'll arrange delivery around the receiver's dates." |
| At depot / awaiting inspection | "After inspection we'll confirm any work needed, then arrange delivery." |
| Inspected, no issues | "The bike is being cleaned and prepared; we'll then arrange your delivery dates." |
| Issues found | "We'll send the repair options for approval; once decided, work starts and delivery is arranged after." |
| Repairs underway | "Once the work is finished and the bike is cleaned, we'll arrange delivery." |
| Service complete | "We'll arrange your delivery dates next and send the time slot the day before." |
| Bike on its way to buyer (sender) | "Nothing needed from you — the buyer will be kept updated through to delivery." |
| Delivery booked | "You'll get your time slot the day before; have the bike ready / be in to receive it." |
| Box My Bike stages | Next packing/hand-off step in plain English. |
| Foam My Bike / NI stages | Next step including the ferry leg wording already used. |

Implementation:
- Add a `nextStep` string to each stage definition (alongside the existing `headline`/`lines`), or a `nextStepFor(stageKey)` helper — one place to edit.
- Render it as a small panel in the HTML email ("What happens next:" + the line) and as a plain-text line in the text part, just above the existing "Typical time frames" note.
- No changes to wording of existing lines, recipients, triggers, or the 4-day quiet rule.

## Files

- `supabase/functions/send-order-updates/index.ts` (stage definitions + `buildHtml`/`buildText`)
- Redeploy `send-order-updates`

## Verification

- Typecheck/build
- Trigger the function for one test order per a couple of stages (or render the HTML directly) and screenshot the email to confirm the new section reads well on desktop and mobile widths.
