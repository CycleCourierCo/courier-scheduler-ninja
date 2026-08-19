# Instant availability after booking (business senders)

## Goal

When a business account creates an order, send them straight to the sender availability page instead of making them wait for the email. On that page, if they are the sender, let them pick "bike available now" (auto-fill dates from their opening hours) or "available later" (pick dates themselves).

## Flow

```text
Business creates order
        |
        v
Order created (email still sent as today)
        |
        v
Redirect to /sender-availability/<order id>
        |
   are they the sender?
        |                     \
       yes                     no
        |                       \
  two options:                   existing date-picker only
  1) Available now  -> next 7 working days pre-selected
                       from their profile opening hours
  2) Available from -> normal calendar, they pick dates
        |
        v
  Submit -> same save path as today -> dashboard
```

## What changes

1. **Redirect after creation** — after a successful booking, a business/B2B account goes to the sender availability page for the new order instead of the dashboard. Non-business accounts keep going to the dashboard. The confirmation toast stays, plus a short line explaining they can set collection availability now.

2. **"Are they the sender?" check** — the availability page treats the logged-in account as the sender when the order's sender email matches their profile email (or their company/accounts email). Otherwise the page behaves exactly as it does today.

3. **New choice on the availability page (sender-as-business only)** — two options at the top:
   - *Bike is available now, collect within business hours* — pre-selects the next 7 days that are open in their profile opening hours, skipping closed days, company holidays and non-allowed Fridays (same rules the calendar already enforces). The selected dates are shown, and their opening times per day are added to the collection notes so drivers know the window. They can still deselect a day before submitting.
   - *Bike isn't available yet* — reveals the existing calendar so they choose the dates the bike will be ready.

4. **No change to saving** — both paths submit through the existing sender availability save, so status transitions, emails and tracking stay identical.

## Technical notes

- `src/pages/CreateOrder.tsx`: change the post-submit `navigate('/dashboard')` to `navigate('/sender-availability/<order.id>')` when the profile is a business account.
- `src/pages/SenderAvailability.tsx`: add a mode selector above `AvailabilityForm`. Existing `useAvailability` hook, `isDateDisabled`, holiday and allowed-Friday logic are reused unchanged.
- Opening hours come from the profile (`opening_hours`, shape in `src/types/user.ts` with `DEFAULT_OPENING_HOURS` fallback); a small helper generates the next 7 open working days and formats the hours text for notes.
- Sender-match and business detection use the current auth profile already available in the app's auth context; no schema changes and no new tables.

## Out of scope

- Receiver availability page behaviour.
- Changing which emails are sent.
