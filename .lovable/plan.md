

## Fix: Inconsistent price units causing wrong "Cheapest" badge

### Problem
The GOV.UK Fuel Finder API returns prices in mixed units — some stations report in **pounds** (e.g., `1.899`) and others in **pence** (e.g., `177.9`). The edge function stores the raw value without normalizing. When the frontend computes `Math.min(...)`, it picks `1.899` as the lowest number and labels that station "Cheapest", even though 177.9p is actually cheaper.

### Fix
Normalize all prices to **pence** at two points:

1. **Edge function** (`supabase/functions/fuel-finder/index.ts`): After parsing the price, check if the value is less than 10 (clearly in pounds) and multiply by 100 to convert to pence. This fixes prices at write time for all future caches.

2. **Frontend** (`src/pages/FuelFinderPage.tsx`): Apply the same normalization when reading `diesel_price` from the cache (line ~220), so existing cached data with pound values also displays correctly without requiring a cache refresh.

### Normalization logic
```
if (price < 10) price = price * 100;  // Convert pounds to pence
```

Any diesel price below 10 is clearly in pounds (diesel hasn't been under 10p/litre in decades), so this threshold is safe.

### Files
- `supabase/functions/fuel-finder/index.ts` — normalize price when building upsert rows (~line 183)
- `src/pages/FuelFinderPage.tsx` — normalize price when mapping cached data (~line 220)

