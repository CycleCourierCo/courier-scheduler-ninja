# Route planners can't see vans + inspections should offer work to the account holder too

Two separate fixes.

## 1. Route planners see no vans when generating routes

Confirmed cause: the van list is read straight from the vehicle records, and those records can
only be read by admins. A route planner opening Generate Routes gets an empty list, so they
can't tick any van and can't generate.

Fix, keeping route planners out of the full vehicle records:

- Add a server-side lookup that returns only what planning needs for each van: name,
  bike spaces and whether it's in use or off road. Nothing about MOT, tax, mileage or costs.
- Allow admins, sales and route planners to use that lookup; everyone else is refused.
- Point the Generate Routes van list at it instead of reading vehicle records directly.
- Route planners already have permission to mark a van unavailable for a day, so the
  day/van grid will work as soon as the list loads.

## 2. Repairs can only be offered to the receiver

Confirmed today:

- The "who approves?" dropdown already offers the booking account, the sender and the receiver.
- The **declined-repairs offer** only ever goes to the receiver — no choice of person.
- The **who-to-bill pop-up** for inspection invoices only offers "Bill the sender" and
  "Bill the receiver" — the account that booked the job isn't there.

Fix both:

- Declined repairs: add a person picker (account that booked / sender / receiver) before
  sending the offer, disabling anyone with no email or phone on the job. The offer email,
  text message and public approval link work the same way for whoever is chosen, and any
  repairs they approve are billed to them.
- Who-to-bill pop-up: add the account that booked the job as a third option, shown with
  its company name, contact name and email, alongside the sender and receiver cards.

## Technical notes

- Migration: `get_planning_vans()` as a SECURITY DEFINER function returning
  `id, name, bike_spaces, status`, with an internal role check
  (admin / sales / route_planner) and `EXECUTE` granted to `authenticated`.
  No change to the `vehicles` table policies.
- `src/services/routeGenerationService.ts` — `fetchPlanningVans` calls the new function
  and keeps the existing `in_use` / `off_road` filter and capacity mapping.
- `supabase/functions/send-repair-offer/index.ts` — accept a validated
  `recipient: "customer" | "sender" | "receiver"`, resolve email/phone from the booking
  profile or the order snapshot, and record who the offer went to on each issue
  (reusing the existing offered/declined columns plus the chosen party).
- `supabase/functions/create-inspection-invoice/index.ts` — widen `billFrom` to include
  the booking account and build its party details from the `profiles` row.
- `src/components/inspections/BillingCustomerDialog.tsx` — `BillingPartyDetails.side`
  gains `"account"`; `BillingParties` gains `account`.
- `src/pages/BicycleInspections.tsx` — offer-recipient select next to the offer button,
  and pass the booking account into the billing dialog.
