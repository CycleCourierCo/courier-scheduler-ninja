# Fix: grouped timeslot messages mixing different customers

## What went wrong
Steve Linham (LE16 8NQ) and Oliver Sloman (LE16 8BD) are both in Market Harborough, under 750m apart, both delivered at 10:00 on 5 Oct. The stop cards correctly kept them separate, because they have different emails. But the "send all timeslots" button groups stops on location only. It ignores who the customer is, so it sent Steve one combined message that included Oliver's delivery.

## Fix
- "Send all timeslots" will use the same grouping as the stop cards: one message per customer at one place. Two jobs only share a message when they're at the same place AND have the same email or phone (Northern Ireland ferry handoffs still bundle together, as they do now).
- Tighten the stop-card grouping as well. At the moment, if either job has no email or phone, it falls back to grouping by location only. Instead, those jobs will only group when the address and postcode also match.
- Combined messages list each bike from the order's full bike list instead of the old single brand/model, so they no longer say "Unknown Brand".

## Technical details
- `RouteBuilder.tsx` send-all (~3185–3207): replace the coordinate-only `coordinateGroups` with `groupJobsByLocation(jobsToSend)` and bucket by the `locationGroupId` it returns. Groups of 1 are sent on their own.
- `groupJobsByLocation` (~2448): when a contact key is missing, also require a matching normalised postcode before merging.
- Collections/deliveries lists in both grouped senders (~3100, ~3224): build them from `orderData.bikes`, falling back to `bike_brand`/`bike_model`.
- No backend change needed. Steve has already had the wrong message, so it may be worth sending him a corrected one.
