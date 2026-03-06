

## Investigation Findings

The timeslip for Ramish has **10 unique job stops** and the route link correctly includes all 10 as waypoints:

```
origin=depot → 10 waypoints → destination=depot
```

All 10 job coordinates are present in the URL, including CCC754759083296EVADT1 (51.083258, -4.057697) as the last waypoint. However, Google Maps has a practical limit of **10 waypoints** in URL-based directions, and at exactly 10 it can fail to display the last one, showing only 9 job pins plus the depot.

## Plan: Fix route splitting to cap at 9 waypoints per segment

**File: `supabase/functions/generate-timeslips/index.ts`**

Change `maxWaypoints` from `10` to `9` (line 263). This ensures:
- Routes with up to 9 stops: single route link (depot → 9 waypoints → depot)
- Routes with 10+ stops: split into chained segments of 9 waypoints each

This is a one-line change that prevents the Google Maps rendering issue at the 10-waypoint boundary.

After deploying, Ramish's timeslip would need to be regenerated (or the route link manually updated) to reflect the fix.

