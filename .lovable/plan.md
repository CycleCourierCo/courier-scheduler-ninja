

## Add Sort Button to Fuel Finder Results

### What
Add a sort toggle in the results header bar (next to the station count and Refresh button) that lets users sort stations by:
- **Price** (cheapest first) — default
- **Distance** (nearest first)
- **Last Updated** (most recent first)

### How

**File: `src/pages/FuelFinderPage.tsx`**

1. Add state: `const [sortBy, setSortBy] = useState<"price" | "distance" | "updated">("price")`
2. Import `ArrowUpDown` from lucide-react and `DropdownMenu` / `DropdownMenuTrigger` / `DropdownMenuContent` / `DropdownMenuItem` from the existing UI components.
3. Add a `sortedStations` memo that sorts `stations` based on `sortBy`:
   - `price`: ascending by `diesel_price`
   - `distance`: ascending by `distance_miles`
   - `updated`: descending by `last_updated` date
4. Replace `stations.map(...)` with `sortedStations.map(...)` in the render.
5. Add a dropdown button between the station count text and the Refresh button in the results header (line ~287-291):

```text
[12 stations found]  [↕ Price ▾]  [↻ Refresh]
```

### Files
- `src/pages/FuelFinderPage.tsx` — add sort state, sorted memo, dropdown UI

