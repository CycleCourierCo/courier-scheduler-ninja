# Keep customers updated automatically (email only)

Goal: no customer should ever have to email us asking "where's my bike?". Every job gets a proactive email at each real milestone, plus a reassurance email every 2 days whenever a job sits still — to both sender and receiver, as relevant to their side.

## 1. Proactive "keep-alive" update engine

A new scheduled job runs each morning, looks at every live order, works out which stage it is stuck in and how long it has been silent, and emails the right party if it has been 2 or more days since we last contacted them about that job.

Stages covered, with the message each side gets:

| Situation | Who we email | Message |
| --- | --- | --- |
| Order booked, sender availability not requested yet | Sender (and booking customer) | "We've got your booking. We'll be in touch to arrange collection dates shortly." |
| Availability request sent, no dates chosen yet | Whichever side hasn't replied | Friendly reminder with the same availability link |
| Dates chosen, still finding a route to fit them | That side | "Thanks for your dates — we're building a route that fits them and will confirm your time slot as soon as it's set." |
| Bike collected, in depot / inspection / repair | Sender + receiver | "Your bike is safely with us at our depot" (plus inspection/repair wording where relevant) |
| Repairs approved/declined, awaiting delivery scheduling | Receiver | "Your bike is ready to go — we're arranging your delivery dates now." |
| Box My Bike stages (awaiting depot, in depot, boxed, awaiting/collected by 3rd party) | Sender + receiver | Current packing/hand-off stage in plain English |
| Foam My Bike / Northern Ireland (pending foaming, foamed, at ferry) | Sender + receiver | Current stage, with the onward-by-ferry wording already used elsewhere |

Rules:
- Send at most one update per side per job every 2 days, and never on the same day as a milestone email (time slot, collection or delivery confirmation) so nothing double-fires.
- Skip cancelled and delivered jobs, and skip test accounts (same suppression already used for Shipday/email).
- Northern Ireland delivery legs keep the existing routing: ferry hand-off contact gets logistics mail, the actual receiver gets the customer-facing update.

## 2. Expected time frames in every email

Every update and milestone email ends with a short expectations note so customers know what "normal" looks like:

- "We typically collect within 2-4 working days of dates being agreed, and deliver within 2-4 working days of collection."
- Where the collection or delivery postcode falls in a remoter area, the note switches to a longer wording: "Because this journey covers a more remote area, please allow a little longer than our usual 2-4 working days."
- Remote areas covered: Cornwall and Devon, the Lake District and far north west, Scotland (especially the Highlands and islands), mid and west Wales, Northern Ireland, and the Isle of Wight / other islands.
- Northern Ireland already gets ferry wording; the remote note sits alongside it rather than replacing it.
- The area list lives in one place in code so it can be tuned later without touching each email.


## 2. Milestone gaps to close

Add emails where today we go quiet even though something happened:
- Collection scheduled: confirm the arranged date to the receiver too, not just the sender.
- Inspection completed / repairs approved / repairs completed: notify sender and receiver.
- Delayed job: if a scheduled collection or delivery date passes without the Shipday stop completing, send an apology-plus-reschedule note the next morning.

## 3. Admin visibility

On the order page, a small "Customer updates" list showing every update email sent, to whom and when, so CS can see at a glance whether a complaining customer was actually kept informed. This reads from the existing email delivery event records plus the new update log.

## Technical notes

- New table `order_update_log` (order_id, side: sender/receiver, stage_key, sent_at) to enforce the 2-day rule and power the admin panel. RLS: staff read, service role write.
- New edge function `send-order-updates`: validates `x-cron-secret` via `get_cron_secret()`, pages through live orders, derives stage from `status`, `box_my_bike_status`, `foam_status`, `inspection_status`, availability confirm timestamps and scheduled dates, then sends through the existing `send-email` function.
- New `emailType` cases in `supabase/functions/send-email/index.ts` for the stage messages, reusing current branding, `Info@notification.cyclecourierco.com` sender and `Info@cyclecourierco.com` reply-to.
- `pg_cron` entry to invoke it daily at 08:00 Europe/London through a `SECURITY DEFINER` wrapper, matching the existing cron pattern.
- Manual "Send update now" button on the order detail page for CS, calling the same function for a single order.
