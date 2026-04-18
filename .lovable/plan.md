

## Show "Mark as Repaired" button to mechanics

### Root cause
`src/pages/BicycleInspections.tsx` line 598:
```tsx
{isAdmin && inspection?.status === "in_repair" && issue.status === "approved" && (
```
Only admins see the button. Mechanics are blocked even though they have RLS permission to update issues.

### Fix
Change the condition to:
```tsx
{(isAdmin || isMechanic) && inspection?.status === "in_repair" && issue.status === "approved" && (
```

### Also check (same file)
While there, verify other action buttons restricted to `isAdmin` that mechanics should also use — specifically anything in the In Repair tab workflow (e.g. "Move to Repaired" for the inspection, "Reset to Pending"). I'll audit all `isAdmin && ...` checks in `BicycleInspections.tsx` and broaden the operational ones (start inspection / report issue / mark repaired / move to repaired) to `isAdmin || isMechanic`. Destructive actions (delete) stay admin-only.

### Files
- `src/pages/BicycleInspections.tsx` — single-file change, no DB or backend work needed (RLS already permits mechanic).

### Verification
- Log in as mechanic → open an inspection in "In Repair" with an approved issue → "Mark as Repaired" button appears and works → once all approved issues are marked repaired, mechanic can move bike to "Repaired".

