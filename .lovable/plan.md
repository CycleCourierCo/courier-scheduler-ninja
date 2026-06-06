## Add "Collected" tab to Bicycle Inspections (mutually exclusive with Awaiting)

A new **Collected** tab on the Bicycle Inspections page, placed directly after **Awaiting**. Each uninspected bike lives in exactly one of the two tabs based on whether it has been physically picked up.

### Filter rules
Both tabs share the same base: orders that have no inspection record or whose inspection status is `pending`.

- **Awaiting** — `pickup_date` is null (bike not yet collected)
- **Collected** — `pickup_date` is not null (bike has been picked up and is waiting to be inspected)

Inspected, in-pricing, in-repair, delivered and cancelled bikes do not appear in either tab.

### Changes — `src/services/inspectionService.ts`
Add `pickup_date` to the `.select(...)` lists in `getPendingInspections` (~line 193) and `getMyInspections` (~line 240) so the field is available on the client.

### Changes — `src/pages/BicycleInspections.tsx`

1. **Update the awaiting filter** (~line 660) and add the collected filter:
   ```ts
   const awaitingBase = filteredInspections.filter(
     (i: any) => !i.inspection || i.inspection.status === "pending"
   );
   const awaitingInspection = awaitingBase.filter((i: any) => !i.pickup_date);
   const collected = awaitingBase.filter((i: any) => !!i.pickup_date);
   ```

2. **New `TabsTrigger value="collected"`** inserted right after the `awaiting` trigger, before `pricing`:
   - Label: `Collected`
   - Badge: `secondary` variant showing `collected.length` when > 0

3. **New `TabsContent value="collected"`** mirroring the Awaiting block: maps `collected` through `renderInspectionCard`, with empty-state "No collected bikes awaiting inspection".

No database, RLS or edge-function changes required.