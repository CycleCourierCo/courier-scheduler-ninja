## Fix Claim Detail "Something went wrong" + show collection/delivery drivers

### Root cause
`src/pages/ClaimDetail.tsx` calls `useMemo` for `derived` before the `if (!claim) return …` early return, then calls another `useMemo` for `cap` after it. When the claim finishes loading, the hook count changes between renders → React error #310 → ErrorFallback ("Something went wrong").

### Changes

**`src/services/claimsService.ts`**
- In `DerivedClaimFields`, replace `driverName: string | null` with:
  - `collectionDriverName: string | null`
  - `deliveryDriverName: string | null`
- In `deriveClaimFields`, replace the `driverName` line with:
  - `collectionDriverName: order?.collection_driver_name ?? null`
  - `deliveryDriverName: order?.delivery_driver_name ?? null`

**`src/pages/ClaimDetail.tsx`**
1. Move the `cap` `useMemo` (currently after the early return) up next to the `derived` `useMemo`, before `if (!claim || !derived) return …`. Make it null-safe by reading from `claim` + `draft` directly and returning `null` when `claim` is null. Keep the early return.
2. In the sticky summary card, replace the single `Driver:` row with two rows:
   - `Collection driver: {derived.collectionDriverName ?? "—"}`
   - `Delivery driver: {derived.deliveryDriverName ?? "—"}`
3. In the Linked Order panel (Details tab), do the same swap.

No DB migration, no new queries.
