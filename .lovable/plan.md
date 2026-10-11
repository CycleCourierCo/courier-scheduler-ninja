# Insurance tab shows vans in use only

## What the user asked
On the Insurance tab, show the vans that are in use — the same as the Vehicles tab.

## Current state (verified)
- `src/pages/VehicleManagement.tsx` builds `inUseVehicles` (vehicles with `status === "in_use"`) and passes it to the coverage timeline on the Vehicles tab, but passes the **full** `vehicles` list to `<InsuranceTab />` on the Insurance tab.
- Because of that, the Insurance tab shows every vehicle (sold, written off, reserved, purchased, etc.) in: the "Uninsured vehicles" card, the coverage timeline, and the vehicle filter dropdown above the Policies table.

## Change (frontend only, no database work)
In `src/pages/VehicleManagement.tsx`, pass `inUseVehicles` to `<InsuranceTab />` instead of `vehicles`, matching the Vehicles tab behaviour:

```tsx
<TabsContent value="insurance">
  <InsuranceTab vehicles={inUseVehicles} />
</TabsContent>
```

No changes needed inside `InsuranceTab.tsx`, `insuranceService.ts` or the timeline — they all render from the list they're given.

## Notes
- Policies attached to vans not in use will no longer appear in the Insurance tab's filter dropdown or timeline (same as the Vehicles tab today). Existing policy rows in the database are untouched.
- The "Uninsured vehicles" card will now only check vans in use; `getUninsuredVehicles` keeps its existing sold/written-off guard as a harmless safety net.
