# Ship As-Is inspection status

## Goal

When a bike has repair issues that the sender declines, and those repairs are either never offered to the buyer or the buyer declines them too, the inspection currently ends at **"repaired"** — even though no work was done. Introduce a dedicated terminal status **`ship_as_is`** so staff can see the bike is being delivered *unrepaired*, while everything downstream (delivery scheduling, receiver availability emails, packing gates) treats it exactly like "repaired".

## Rules

- `ship_as_is` applies when: all issues have been responded to, there is **no approved/outstanding work**, and at least one **declined** issue is fully closed (never offered to receiver, or receiver declined).
- `repaired` remains only for inspections where approved work was actually completed (or issues resolved).
- `ship_as_is` is terminal like `repaired`: service is complete, no cleaning stage required, order proceeds to delivery.

## Changes

### 1. Types
- `src/types/inspection.ts`: add `'ship_as_is'` to `InspectionStatus`.

### 2. Status reconciliation (client)
- `src/services/inspectionService.ts` — `reconcileInspectionStatuses()`: in the three branches where the fall-through is currently `nextStatus = 'repaired'` with no outstanding approved work, use `'ship_as_is'` instead. Include `ship_as_is` in the recompute query's status list, and extend the "transition to repaired" side effects (set `released_to_customer_at`, trigger receiver availability email) to fire on `ship_as_is` too.
- Add `ship_as_is` to the service-complete helper (rows.every status repaired → repaired or ship_as_is) around line 105–114.

### 3. Database functions (migration — column is `text`, no enum change needed)
- `public.submit_public_repair_offer(...)`: recompute block — end at `ship_as_is` when nothing approved and declined issues are closed.
- `public.get_public_inspection_summary(...)`: treat `ship_as_is` like `repaired` for the customer-facing summary.

### 4. Gates & stages
- `src/utils/servicingGate.ts`: label `"ship as-is - repairs declined"`; `isServiceComplete()` returns true for `ship_as_is`.
- `src/hooks/useInspectionStages.ts`: `STAGE_RANK.ship_as_is = 8` (same terminal rank as repaired) so Box/Foam packing gates open.

### 5. Proactive emails
- `supabase/functions/send-order-updates/index.ts`:
  - Add a `case "ship_as_is"` next to `case "repaired"` with customer wording like "Your bike has been checked over and is ready to come to you as-is." (no mention of completed repairs).
  - Completion check (~line 655): `statuses.every(s => s === "repaired" || s === "ship_as_is")` so receiver availability prompts aren't held back.

### 6. UI display
- `src/pages/BicycleInspections.tsx`: badge/label for `ship_as_is` (e.g. amber "Ship as-is"), include in any status filters/grouping; make sure the page's own status-recompute logic (if any) matches.
- `src/components/order-detail/TrackingTimeline.tsx`: timeline entry for the new status.
- `src/pages/ReceiverAvailability.tsx`: readiness gate accepts `ship_as_is` like `repaired`.

### 7. Existing data (run_sql, not a migration)
- One-off fix: inspections currently at `repaired` where all issues are `declined` and none `approved`/`repaired`/`resolved` → set to `ship_as_is`.

## Out of scope
- No change to repair invoicing (only approved issues invoice — unchanged).
- No change to the offer-to-receiver flow itself.
- No new DB column or enum; status stays a text value.

## Verification
- Typecheck + `npx vite build`.
- Simulate: inspection with all issues declined → reconcile lands on `ship_as_is`; with receiver declining all offered issues → `ship_as_is`; approved-then-repaired issues still land on `repaired`.
- Playwright: inspection page badge shows "Ship as-is"; Box/Foam gate and receiver availability open for such an order.
