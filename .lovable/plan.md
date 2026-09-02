# Let route planners reset availability dates

## Current state (verified)

On the order detail page:

- "Reset Sender Availability" / "Reset Receiver Availability" — admin only
- Resend availability email and copy availability link — admin or route planner

So route planners can already do everything with dates except the reset. The reset writes to the order and then re-sends the availability email; route planners already have update permission on orders in the database, so no database change is needed.

## The change

In `src/pages/OrderDetail.tsx`, switch the two reset buttons from the admin-only check to the existing admin-or-route-planner check. Nothing else changes — same confirmation-free behaviour, same reset-then-email flow, same disabled state when no dates are set.

Result: a route planner can reset sender or receiver dates, resend the availability email, and copy the availability link.
