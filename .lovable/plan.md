# Fix: Generate routes fails with an error

## What's happening

Pressing **Generate** shows "Edge Function returned a non-2xx status code". The route
generator asks the orders table for a "collection completed" date that does not exist in
the database, so the whole request fails before any planning happens.

## The fix

Stop asking for the non-existent field and work out how long a bike has been with us from
data we do hold:

- Read `order_collected` plus `scheduled_pickup_date` (falling back to the customer's
  agreed pickup date) instead of the missing timestamp.
- "Days in depot" for a delivery = days since that collection date; blank if we have no
  collection date yet.
- Everything else about planning (collect-first ordering, guaranteed dates, van/day
  availability) stays exactly as it is.

## Technical detail

In `supabase/functions/route-optimize/index.ts`:

- Remove `collection_completed_at` from the orders `.select(...)` list (line ~261).
- Add a helper that resolves a collected date: `scheduled_pickup_date` when
  `order_collected` is true, else the first confirmed `pickup_date` entry, else null.
- Use that helper for `days_in_depot` (lines ~350-351) and `collectedAt` (line ~394).
- Redeploy `route-optimize` and confirm a solve returns 200 with routes instead of an error.
