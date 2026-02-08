

## Keep Route Comparison Dialog Open After Loading

Remove the line that closes the dialog when clicking "Load Route", so users can load multiple routes into different tabs while keeping the comparison view open.

---

## Change Required

### File: `src/components/scheduling/RouteBuilder.tsx`

**Line 965** - Remove or comment out this line:

```typescript
setShowRouteComparisonDialog(false);
```

### Before:
```typescript
const handleLoadViableRoute = (analysis: RouteAnalysis) => {
  // Build URL with ALL matched jobs (not just viable)
  const jobParams = analysis.matchResults
    .filter(r => r.matchedOrder && r.jobType)
    .map(r => `${r.matchedOrder!.id}:${r.jobType}`)
    .join(',');
  
  const dateParam = filterDate ? `&date=${format(filterDate, 'yyyy-MM-dd')}` : '';
  
  // Open in new tab
  window.open(`/scheduling?jobs=${jobParams}${dateParam}`, '_blank');
  setShowRouteComparisonDialog(false);  // <-- REMOVE THIS
};
```

### After:
```typescript
const handleLoadViableRoute = (analysis: RouteAnalysis) => {
  // Build URL with ALL matched jobs (not just viable)
  const jobParams = analysis.matchResults
    .filter(r => r.matchedOrder && r.jobType)
    .map(r => `${r.matchedOrder!.id}:${r.jobType}`)
    .join(',');
  
  const dateParam = filterDate ? `&date=${format(filterDate, 'yyyy-MM-dd')}` : '';
  
  // Open in new tab
  window.open(`/scheduling?jobs=${jobParams}${dateParam}`, '_blank');
};
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/scheduling/RouteBuilder.tsx` | Remove line 965 (`setShowRouteComparisonDialog(false)`) |

---

## Expected Behavior

- User opens Compare Routes dialog
- Clicks "Load Route" on any route
- Route opens in a new browser tab
- Dialog stays open so user can load additional routes or close manually via the X button

