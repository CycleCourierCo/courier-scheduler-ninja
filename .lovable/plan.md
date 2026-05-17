## Show bike & tracking number in collapsed storage card header

In `BikesInStorage.tsx`, surface the bike brand/model and tracking number in the `CollapsibleTrigger` so they're visible without expanding.

### Change

In `src/components/loading/BikesInStorage.tsx` (around line 208), inside the trigger, below the customer name row add a small second line showing:
- `{bikeBrand} {bikeModel}` (from `allocations[0]`)
- `Tracking: <span class="font-mono">{order.trackingNumber}</span>`

Styled as `text-xs text-muted-foreground`, truncated on small screens. Keep the existing expanded content (bike + tracking still appear there) unchanged so the accordion remains useful for other details (city, date, value).

No prop, type, or backend changes.
