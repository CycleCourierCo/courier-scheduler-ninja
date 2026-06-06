## Fix Collected vs Awaiting tab filter

The current filter uses `pickup_date`, which doesn't match the "Collected X days ago" badge. The badge uses `collection_confirmation_sent_at` — switch the tab filter to the same field so the tabs match what users see on each card.

### Change — `src/pages/BicycleInspections.tsx` (~lines 660-662)

Replace:
```ts
const awaitingInspection = awaitingBase.filter((i: any) => !i.pickup_date);
const collected = awaitingBase.filter((i: any) => !!i.pickup_date);
```

With:
```ts
const awaitingInspection = awaitingBase.filter((i: any) => !i.collection_confirmation_sent_at);
const collected = awaitingBase.filter((i: any) => !!i.collection_confirmation_sent_at);
```

`collection_confirmation_sent_at` is already selected by `getPendingInspections` / `getMyInspections` (service lines 206, 254), so no service changes are needed. `pickup_date` selection can stay or be removed; leaving it avoids churn.

No DB, RLS, or edge-function changes.
