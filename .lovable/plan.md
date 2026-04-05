

## Fix: Fuel type matching in price parser

### Root Cause
From the edge function logs:
- Stations: 7603 (good)
- Prices: 7551 (good)  
- **Price map: 0 entries** (bad)
- Results: 0 stations (consequence of empty price map)

The price sample shows: `"fuel_type":"B7_STANDARD"` but the code checks:
```typescript
if (grade === 'B7' || grade.toLowerCase().includes('diesel'))
```
`"B7_STANDARD"` does not equal `"B7"` and does not contain `"diesel"`, so every price entry is skipped.

### Fix
In `supabase/functions/fuel-finder/index.ts`, update the diesel fuel type matching to include B7 variants:

```typescript
if (grade === 'B7' || grade === 'B7_STANDARD' || grade.startsWith('B7') || grade.toLowerCase().includes('diesel'))
```

This is a one-line change in the price map building loop. Redeploy the edge function afterward.

### Files
- `supabase/functions/fuel-finder/index.ts` — fix fuel type matching condition

