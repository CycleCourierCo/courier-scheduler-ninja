## Fix: Missing Inspection and Tab Restructuring

### Problem 1: Missing Inspection

Inspection `4df3ef71-b44f-4194-bf18-7e8856983ca6` (order `8b7e2c53`) is not showing because the query in `inspectionService.ts` excludes orders with status `delivered` or `cancelled`. This order has been delivered, so it gets filtered out -- but the inspection status is `inspected` (completed with no issues), which should still be visible.

**Fix:** Remove the status exclusion filter from `getPendingInspections()` so all orders with `needs_inspection = true` are shown regardless of order status. Delivered/cancelled bikes that have been inspected are important to see in the completed tabs.

### Problem 2: Tab Restructuring

Currently there are 5 tabs: Awaiting, No Issues, Issues, In Repair, Repaired.

**Change:** Replace "No Issues" and "Repaired" tabs with a single "Inspected and Serviced" tab that shows bikes with inspection status `inspected` (no issues found) OR `repaired` (issues were found and fixed).

### Files to Change

**1. `src/services/inspectionService.ts**`

- In `getPendingInspections()` (around line 100): Remove the `.not('status', 'in', '("delivered","cancelled")')` filter so all inspected orders appear

**2. `src/pages/BicycleInspections.tsx**`

- Replace the two filter arrays `noIssues` and `repaired` with a single `inspectedAndServiced` array that includes orders where `inspection.status` is `inspected` OR `repaired`
- Replace the "No Issues" and "Repaired" tab triggers with a single "Inspected and Serviced" tab trigger
- Replace the two `TabsContent` sections with a single one for the combined tab
- Update the empty state message to "No bikes inspected and serviced yet"

### Summary of New Tabs

1. **Awaiting** -- bikes pending inspection (no inspection record or status `pending`)
2. **Issues** -- bikes with issues awaiting customer response (status `issues_found`)
3. **In Repair** -- bikes being repaired after customer approval (status `in_repair`)
4. **Inspected and Serviced** -- all completed bikes, both clean inspections and repaired ones (status `inspected` or `repaired`)