# Fix plan

## What I’ll change
- Update the scheduling filter logic so **Expired availability dates** works as an additive filter.
- When a date is selected (for example 16th), the result should include:
  - jobs available on that selected date
  - plus jobs whose availability dates are fully expired
- Keep the map and the route-builder job count/list using the exact same rule.

## Implementation
1. **Unify the visibility rule in `RouteBuilder.tsx`**
   - Refactor the pickup and delivery filter checks into one consistent condition.
   - Ensure the expired toggle means:
     - normal mode: only jobs matching the selected date
     - expired mode: jobs matching the selected date **or** jobs with all dates expired
   - Apply the same rule to the `availableJobs` count and cards list.

2. **Mirror the same rule in `JobScheduling.tsx`**
   - Keep `filteredOrdersForMap` aligned with the route-builder logic so the map and list don’t disagree.
   - Preserve existing collected / collecting-before / inspected / job-type filters.

3. **Tighten the date-expired comparison**
   - Reuse the same date normalization for both selected-date matching and expired detection.
   - Avoid edge cases where parsing or timezone formatting causes a job to fail both checks.

## Technical details
- Files:
  - `src/components/scheduling/RouteBuilder.tsx`
  - `src/pages/JobScheduling.tsx`
- Expected result:
  - If 108 jobs match the 16th and 4 jobs are expired, enabling the expired toggle should show **112** jobs, not 0.
- Scope:
  - No UI redesign
  - No database changes
  - No changes to unrelated filters