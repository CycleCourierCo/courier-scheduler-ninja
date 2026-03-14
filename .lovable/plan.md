

## Show Bike Values on Loading & Storage Page

### What
Display the total value of bikes in three areas of the Loading/Storage page:
1. **Per driver group** in Pending Storage Allocation — total value of bikes in each driver's van / pending allocation
2. **Pending Storage Allocation card header** — total value across all pending bikes + loaded bikes
3. **Bikes in Storage card header** — total value of all bikes currently in storage

### Changes

**1. `src/pages/LoadingUnloadingPage.tsx`**

In the card headers, calculate and display total values:

- **Pending Storage section** (line ~1360): Calculate total value from `collectedBikes` and `bikesLoadedOntoVan` using `order.bikeValue` (or summing from `order.bikes` array). Show e.g. `"5 bike(s) collected • Total value: £12,500"`
- **Bikes in Storage section** (line ~1381): Calculate total value from `bikesInStorage` orders. Show e.g. `"8 bike(s) in storage • Total value: £24,000"`

**2. `src/components/loading/PendingStorageAllocation.tsx`**

In each driver group header (line ~183-194), calculate and show the total value for that driver's bikes:

```tsx
const driverValue = [...collectedForDriver, ...loadedForDriver].reduce((sum, bike) => {
  return sum + (bike.bikeValue || 0);
}, 0);

// In the header, after the badge:
{driverValue > 0 && (
  <Badge variant="outline" className="text-xs">
    £{driverValue.toLocaleString()}
  </Badge>
)}
```

Also show value per bike card (line ~292-294 and ~202-204) alongside brand/model.

**3. `src/components/loading/BikesInStorage.tsx`**

Show value per bike card (line ~265-267) alongside brand/model, and per driver group if applicable.

### Summary
- 3 files changed
- No database changes needed (bike_value already exists)
- Values displayed using `order.bikeValue` field with `£` formatting and `.toLocaleString()` for comma separation

