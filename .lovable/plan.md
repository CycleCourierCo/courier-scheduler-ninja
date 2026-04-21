

## Fix: Route planner can't see opening hours + show only on the matching stop

### Root cause

**Issue 1 — Route planner sees no hours.** RLS on `profiles` only allows a user to SELECT their own row or admins to SELECT all (`Consolidated profiles SELECT policy`). The `route_planner` role is not granted access, so the query in `RouteBuilder.tsx` (lines 800–815) silently returns zero rows for non‑admins. Hence no badges in the route, and no hours block in the timeslot dialog.

**Issue 2 — Hours show on the wrong stop.** A B2B account is usually the business at one end of a job (sender on outbound, receiver on inbound). Right now the badge/dialog uses the order's `user_id` opening hours for **both** pickup and delivery, even when that stop is actually a private customer at the other end. The hours should only apply when the stop's contact email matches the B2B account's email (or `accounts_email`).

### Fix

**1. RLS — let route planners read opening hours (and only that)**

Create a security‑definer RPC `get_business_opening_hours(user_ids uuid[])` that returns `(id, email, accounts_email, opening_hours, is_business)` for the requested ids, gated to admin / route_planner / loader. This keeps the existing strict profiles SELECT policy intact (no PII leak) while exposing exactly the four fields needed for scheduling.

Update `RouteBuilder.tsx` to call this RPC instead of `from('profiles').select(...)`. Store `email` / `accounts_email` alongside `opening_hours` in `profileOpeningHours` so the matching check below can run.

**2. Match opening hours to the correct stop only**

In `getOpeningHoursBadge` (and the dialog `selectedDayHours` block), add a `stopEmail` parameter and only return a badge when:

```text
stopEmail (lower-cased, trimmed) === profile.email
  OR stopEmail === profile.accounts_email
```

Wire it up at the call sites:
- Job row badge (lines ~411 and ~498): pass `job.orderData.sender.email` for pickups, `job.orderData.receiver.email` for deliveries.
- `TimeslotEditDialog`: change the `openingHours` prop to a small object `{ hours, profileEmail, profileAccountsEmail }` and only render the "Opening Hours …" / "Closed on …" / weekly summary blocks when the job's stop email matches.

If no match → no badge, no dialog block (treat as a regular residential stop).

### Files changed

1. **New migration** — `get_business_opening_hours(uuid[])` SECURITY DEFINER returning the four fields, with `EXECUTE` granted only when caller has `admin`, `route_planner`, or `loader` role (function body checks `has_role(auth.uid(), …)` and returns empty otherwise).
2. **`src/components/scheduling/RouteBuilder.tsx`**
   - Replace the `profiles` select with `supabase.rpc('get_business_opening_hours', { user_ids: userIds })`.
   - Store `{ hours, email, accounts_email }` per user_id in state.
   - Update `getOpeningHoursBadge` signature to accept `stopEmail` and short‑circuit to `null` when emails don't match.
   - Pass the right stop email at both badge call sites.
3. **`src/components/scheduling/TimeslotEditDialog.tsx`**
   - Update `openingHours` prop shape to include profile email + accounts_email, plus the job's stop email.
   - Only render the opening‑hours UI when emails match.

No DB schema changes beyond the new function. No change to `create-shipday-order` / WhatsApp functions.

### Verification

- Log in as a `route_planner`, open Route Builder with a route containing a B2B order → opening‑hours badges appear (previously blank).
- B2B account is the **sender** on order A: only the **collection** stop shows the hours badge / dialog block; the delivery (private receiver) shows nothing.
- B2B account is the **receiver** on order B (return / restock): only the **delivery** stop shows hours.
- Non‑business orders (private both ends) show no hours anywhere — unchanged.
- Admin behaviour unchanged.

