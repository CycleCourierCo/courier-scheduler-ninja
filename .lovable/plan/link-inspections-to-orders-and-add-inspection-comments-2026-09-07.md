# Link inspections to orders, and add inspection comments

## What you get

1. **Jump between an inspection and its order**
   - On each bicycle inspection card, a "View order" button opens that order's page.
   - On the order page (Inspect and Service section), a "View inspection" button opens the inspections page focused on that bike.

2. **Comments on an inspection**
   - Customer service, mechanics and admins can add short notes to an inspection, e.g. "customer also wants a quote for pedals".
   - The same notes appear in two places and stay in sync: on the inspection card in the inspections page, and in the Inspect and Service section on the order page.
   - Each note shows who wrote it and when. Authors and admins can delete their own notes.

## How it works

### Data
New table `inspection_comments`:
- `id`, `inspection_id` (FK to `bicycle_inspections`), `order_id` (FK to `orders`), `author_id`, `author_name`, `comment`, `created_at`, `updated_at`.
- Grants: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`; `ALL` to `service_role`; no `anon`.
- RLS: internal staff (existing `is_internal_staff(auth.uid())`, which covers admin, customer service and mechanic) may read and insert; delete limited to the author or an admin (`is_admin()`).
- No changes to existing tables.

### Frontend
- New `src/components/inspections/InspectionComments.tsx` — compact list plus add box, following the pattern of `src/components/order-detail/OrderComments.tsx` but scoped to an inspection and open to internal staff rather than admin only.
- `src/pages/BicycleInspections.tsx`: add the comments block to each inspection card and a "View order" link button in the card header (routes to the existing order detail path).
- `src/components/order-detail/OrderServicesPanel.tsx`: inside the Inspect and Service section, add the "View inspection" button (only when the order has an inspection) and render the same comments component for the order's inspection.
- Deep link: the inspections page accepts an order/tracking query parameter so the "View inspection" button lands on the right bike, reusing the existing search/filter state.

### Not included
- No emails or notifications for new comments.
- No editing of existing comments (add and delete only).
