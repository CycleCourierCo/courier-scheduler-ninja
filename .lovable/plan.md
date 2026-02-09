

## Add Bike Type Filter to Dashboard

Add a multi-select filter for bike types on the Dashboard, following the same pattern as the existing status filter.

---

## Summary

Add a new "Bike Type" filter dropdown that allows users to filter orders by one or more bike types. This will be implemented server-side for performance.

---

## Changes Required

### 1. Update Filter Types (`src/services/orderService.ts`)

Add `bikeType` to the `OrderFilters` interface and apply it in the query:

```typescript
export interface OrderFilters {
  // ... existing fields
  bikeType?: string[];
}
```

Add filtering logic:
```typescript
// Apply bike type filter
if (bikeType && bikeType.length > 0) {
  query = query.in("bike_type", bikeType);
}
```

### 2. Update OrderFilters Component (`src/components/OrderFilters.tsx`)

Add bike type filter state and UI:

**Add bike type options constant:**
```typescript
const bikeTypeOptions = [
  { value: "Non-Electric - Mountain Bike", label: "Non-Electric - Mountain Bike" },
  { value: "Non-Electric - Road Bike", label: "Non-Electric - Road Bike" },
  { value: "Non-Electric - Hybrid", label: "Non-Electric - Hybrid" },
  { value: "Electric Bike - Under 25kg", label: "Electric Bike - Under 25kg" },
  { value: "Electric Bike - Over 50kg", label: "Electric Bike - Over 50kg" },
  { value: "Cargo Bike", label: "Cargo Bike" },
  { value: "Longtail Cargo Bike", label: "Longtail Cargo Bike" },
  { value: "Stationary Bike", label: "Stationary Bike" },
  { value: "Kids Bikes", label: "Kids Bikes" },
  { value: "BMX Bikes", label: "BMX Bikes" },
  { value: "Boxed Kids Bikes", label: "Boxed Kids Bikes" },
  { value: "Folding Bikes", label: "Folding Bikes" },
  { value: "Tandem", label: "Tandem" },
  { value: "Travel Bike Box", label: "Travel Bike Box" },
  { value: "Wheelset/Frameset", label: "Wheelset/Frameset" },
  { value: "Bike Rack", label: "Bike Rack" },
  { value: "Turbo Trainer", label: "Turbo Trainer" },
  // Legacy types for older orders
  { value: "Electric Bikes", label: "Electric Bikes (Legacy)" },
  { value: "Non-Electric Bikes", label: "Non-Electric Bikes (Legacy)" },
];
```

**Add state and handlers:**
```typescript
const [bikeType, setBikeType] = useState<string[]>(initialFilters.bikeType || []);
const [bikeTypePopoverOpen, setBikeTypePopoverOpen] = useState(false);

const handleBikeTypeToggle = (value: string) => {
  const newBikeType = bikeType.includes(value)
    ? bikeType.filter(t => t !== value)
    : [...bikeType, value];
  setBikeType(newBikeType);
  onFilterChange({ status, search, sortBy, dateFrom, dateTo, customerId, bikeType: newBikeType });
};
```

**Add UI popover (similar to status filter):**
A multi-select popover with checkboxes showing all bike type options with selected badges.

### 3. Update Dashboard Component (`src/pages/Dashboard.tsx`)

Add `bikeType` to the filter state:

```typescript
const [filters, setFilters] = useState({
  // ... existing fields
  bikeType: [] as string[],
});
```

Update the filter change handler and clear filters to include `bikeType`.

### 4. Update Props Interface

Update `OrderFiltersProps` to include `bikeType` in the filters type.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/orderService.ts` | Add `bikeType` to interface and query logic |
| `src/components/OrderFilters.tsx` | Add bike type filter UI with multi-select popover |
| `src/pages/Dashboard.tsx` | Add `bikeType` to filter state |

---

## UI Design

The bike type filter will appear as a dropdown button similar to the status filter:
- Shows "All Bike Types" when none selected
- Shows the type name when one selected
- Shows "X types selected" when multiple selected
- Clicking opens a popover with checkboxes for each bike type
- Selected types shown as removable badges at the top of the popover

