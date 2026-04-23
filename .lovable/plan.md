

## Inspection improvements + service-buffer for delivery

### 1. Bicycle Inspections page — sorting + collected-for + customer order #

**File:** `src/pages/BicycleInspections.tsx`

- Add a sort dropdown (admin/mechanic only) above the tabs with options:
  - Oldest collected first (default)
  - Newest collected first
  - Tracking # A→Z
- To know "how long collected for", extend `getPendingInspections` and `getMyInspections` (`src/services/inspectionService.ts`) to also select `collection_confirmation_sent_at` and `created_at` on the order.
- On each card (admin/mechanic view), show a small badge like:
  - `Collected 4d ago` (using `collection_confirmation_sent_at`, formatted with `date-fns/formatDistanceToNowStrict`)
  - If not yet collected, fall back to `Awaiting collection · created 2d ago`
- On each card (customer view), if the order has a `customer_order_number`, show it under the tracking number line: `Order #: ABC-123`.

### 2. Service buffer on receiver availability

**Files:** `src/hooks/useAvailability.tsx`, `src/components/availability/AvailabilityForm.tsx`, `src/pages/ReceiverAvailability.tsx`

- In `useAvailability`, when `type === 'receiver'` AND `order.needsInspection === true`:
  - After computing `earliestSenderDate`, add **3 calendar days** before using it as `minDate` (`addDays(earliestSenderDate, 3)`).
  - Expose a new flag `hasInspectionBuffer: boolean` from the hook.
- In `AvailabilityForm`, accept an optional `bufferNotice?: string` prop and, when set, render a yellow/info `Alert` above the calendar:
  > "This bike will be inspected and serviced before delivery, so we've added a short gap between collection and delivery dates. Please pick dates from the earliest available."
- `ReceiverAvailability.tsx` passes the notice when `hasInspectionBuffer` is true.

### 3. Extra "on the way to service centre" email on collection

**File:** `supabase/functions/send-email/index.ts` (`handleCollectionConfirmation`)

- After the existing receiver "Bike Collected" email succeeds, if `order.needs_inspection === true`, send a **second** email to the receiver:
  - Subject: `Your bike is on the way to our service centre - {tracking_number}`
  - Body: Friendly note explaining the bike has been collected, will now be transported to our service centre for inspection and any agreed work, and they'll be contacted with delivery dates after the service is complete. Includes tracking link and customer order number if present.
  - Uses the same `from`/`reply_to` config as the other emails.
- Wrapped in its own try/catch so a failure doesn't block the flow. Gated so it only fires for inspection orders, and only on the first run (the existing `collection_confirmation_sent_at` guard already prevents repeats).

### Verification

- Admin/mechanic on `/bicycle-inspections` sees a sort dropdown; cards show "Collected Nd ago" badges; sort order updates correctly.
- Customer on `/bicycle-inspections` sees their `customer_order_number` on each card.
- Inspection order: sender picks earliest 25 Apr → receiver page shows banner + earliest selectable date is 28 Apr.
- Non-inspection order: receiver behaviour unchanged (no banner, no buffer).
- Marking a Shipday job collected on an inspection order: receiver gets the standard "Bike Collected" email **and** a second "on the way to our service centre" email; non-inspection orders get only the standard one.

