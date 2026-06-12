## Goal
Let admins manually change an inspection's `status` on the Bicycle Inspections page so they can move an inspection back (or forward) to any stage when needed.

## Changes

### 1. `src/services/inspectionService.ts`
Add `adminSetInspectionStatus(inspectionId: string, status: InspectionStatus): Promise<void>` that updates `bicycle_inspections.status`. No side effects (no email sending, no `released_to_customer_at` mutation) so it's a pure manual override.

### 2. `src/pages/BicycleInspections.tsx`
On each inspection card, when `isAdmin` is true and an inspection record exists, show a small "Change status" dropdown (shadcn `Select`) next to the existing status badge. Options cover the full lifecycle:
- `pending`
- `awaiting_pricing`
- `issues_found`
- `awaiting_parts`
- `awaiting_repair`
- `inspected`
- `repaired`

(`in_repair` omitted — deprecated.)

Wire it to a `useMutation` calling the new service. On success: toast confirmation and invalidate the inspections query so the card re-renders in the correct tab. Show a `confirm()` dialog before applying to avoid accidental clicks.

### 3. RLS
The existing `bicycle_inspections` admin update policy is already in place (admins can update inspections). No migration required.

## Out of scope
- No automatic recalculation of issue statuses, emails, or order flags when the admin overrides status — the override is intentionally a manual escape hatch.
