## Goal

On the Loading page, show the **collection date** for each bike that's pending storage allocation, and in the bike search results.

## Where the date comes from

The collection timestamp is already available on each order at:

```
order.trackingEvents.shipday.updates[]
  .find(u => u.event === 'ORDER_COMPLETED' && u.orderId === pickup_id)
  .timestamp
```

This is the same pickup-leg completion event the components already look at for POD images. Formatted as `DD MMM YYYY` (en-GB), consistent with the existing "Scheduled delivery" line.

## Changes

### 1. `src/components/loading/PendingStorageAllocation.tsx`
- Add a small helper `getCollectionDate(order)` next to the existing `getCollectionImages` helper.
- Under the Tracking number line in each **pending allocation** card (≈line 316), add:
  > `Collected: 14 Aug 2026`
- Do the same on the **loaded onto van** card (≈line 226) so drivers can see when each bike was originally picked up.
- Only render the line when a valid timestamp is present.

### 2. `src/components/loading/BikeSearchSection.tsx`
- Add the same `getCollectionDate` helper (or a shared util — see below).
- Under the Tracking line in each search result card (≈line 267), add the same `Collected: ...` line.

### 3. Optional shared helper
If you'd like, extract `getCollectionDate` (and `getCollectionImages`, which is duplicated across both files today) into `src/utils/loadingUtils.ts` and import from both. Happy to skip and keep it inline for a lighter change — let me know.

No database, service, or type changes. Purely presentational.
