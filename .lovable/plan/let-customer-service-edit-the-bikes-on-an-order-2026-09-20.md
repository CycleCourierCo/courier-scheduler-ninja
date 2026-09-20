# Let customer service edit the bikes on an order

Right now only admins see the "Edit Bikes" button on an order, so customer service has to ask an admin to correct a brand, model, type, or add a bike a customer forgot to book.

There is a second problem behind it: the Customer Service role currently cannot open other customers' orders at all, so the order page and the linked-order shortcuts in the inbox do not work for them.

## What changes

- Customer service staff can open any order (same read access route planners already have), so linked orders from the inbox open properly.
- The "Edit Bikes" button appears for customer service as well as admins. Same dialog as today: change brand, model and type, add bikes up to 8, or remove one.
- Bike edits by customer service are limited to the bike details only. They cannot change addresses, dates, statuses, prices or anything else on the order through this route.
- Every bike edit is recorded against the order's change log so it is clear who changed what and when.

## What stays the same

- Admin behaviour is unchanged.
- Other staff roles gain nothing.
- Removing a bike that already has details still asks for confirmation.
- Invoicing and route capacity keep reading the bike list as they do now, so a corrected bike count flows through to pricing and van space automatically.

## Technical notes

- Add `cs_agent` to `orders_authenticated_select_policy` so customer service can read orders.
- Do **not** give `cs_agent` a broad UPDATE policy on `orders` — row-level policies cannot be limited to single columns. Instead add a `SECURITY DEFINER` function `public.cs_update_order_bikes(p_order_id uuid, p_bikes jsonb)` with `SET search_path = public` that checks `has_role(auth.uid(), 'cs_agent')` or `has_role(auth.uid(), 'admin')` and writes only `bikes`, `bike_brand`, `bike_model`, `bike_quantity`, `updated_at`. Grant execute to `authenticated` only.
- Log the change into `order_update_log` from inside that function (order id, actor, old and new bike summary).
- `updateOrderBikes` in `src/services/orderService.ts` calls the new function for non-admins (or for everyone, keeping a single path) instead of a direct table update.
- `src/components/order-detail/ItemDetails.tsx`: change the button gate from `hasRole(userProfile, 'admin')` to `hasAnyRole(userProfile, ['admin','cs_agent'])`.
- No change to the edit dialog itself, bike type options, or `getGroupedBikes`.
