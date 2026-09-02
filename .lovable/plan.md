# Give customer service the availability controls

## Current state (verified)

On the order detail page the three availability controls are gated like this:

- Reset sender/receiver availability — admin only
- Resend availability email — admin or route planner
- Copy availability link — admin or route planner

So a `cs_agent` sees none of them.

There is also a database-side blocker: the `orders` table policies do not mention `cs_agent` at all — no read policy and no update policy. A customer service user can only see orders they own, and cannot save a reset.

## The change

1. Frontend (`src/pages/OrderDetail.tsx`): add a "can manage availability" check covering admin, route planner and `cs_agent`, and use it for all six buttons (reset, resend, copy — both sides). Reset stays behind a confirmation as it is today.
2. Database: add `cs_agent` to the orders read policy and add an update policy for `cs_agent` so the reset actually writes.

Copying the link is purely client-side and needs no backend change; resending the email goes through the existing edge function.

## Technical notes

- New helper in `OrderDetail.tsx`: `const canManageAvailability = hasAnyRole(userProfile, ['admin','route_planner','cs_agent'])`, replacing `isAdmin` on the two reset buttons and `isAdminOrRoutePlanner` on the resend/copy buttons.
- Migration: extend `orders_authenticated_select_policy` to include `has_role(s.uid,'cs_agent')` and add `orders_cs_agent_update_policy` mirroring the route planner policy.
- Also confirm the `cs_agent` role has route permission for the order detail route in `role_route_permissions`; add it if missing.
