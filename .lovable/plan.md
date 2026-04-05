

## Fix Fuel Finder Timeout Issue

### Root Cause
The edge function fetches ~7,600 stations (15+ batches) and ~7,500 prices (15+ batches) sequentially from the GOV.UK API. Each batch requires a separate HTTP request, and the token expires mid-way requiring re-auth. This takes 60-90+ seconds, exceeding Supabase's edge function timeout (~60s on free tier). The logs confirm: "Fetching stations..." then "shutdown" — the function is killed before it can return results.

### Solution: Cache results in Supabase DB + serve from cache

Instead of fetching all 15,000+ records from the GOV.UK API on every user search, cache the data in a Supabase table and refresh it periodically.

**1. New DB table: `fuel_station_cache`**
- Columns: `node_id`, `brand`, `name`, `address`, `postcode`, `latitude`, `longitude`, `diesel_price`, `last_updated`, `cached_at`
- No RLS needed (read by edge function with service role)

**2. Split the edge function into two operations:**

**a) `fuel-finder` with `mode: "refresh"` (admin-triggered or cron)**
- Fetches all stations + prices from GOV.UK API
- Upserts into `fuel_station_cache`
- Can run with a longer timeout or be broken into smaller steps
- Called via a button on the admin UI or a cron job

**b) `fuel-finder` with `mode: "depot"` or `mode: "route"` (user search)**
- Reads from `fuel_station_cache` table directly using Supabase client
- Filters by distance using the haversine formula in SQL or in-memory
- Returns instantly — no external API calls needed

**3. Frontend changes:**
- Move station search to query `fuel_station_cache` directly via Supabase client (no edge function needed for searches)
- Add a "Refresh Prices" button for admins that triggers the cache refresh
- Show `cached_at` timestamp so users know how fresh the data is
- Add a "Last refreshed: X ago" indicator

### Architecture

```text
User clicks "Search"
  → Frontend queries fuel_station_cache via Supabase SDK
  → Filters by distance client-side (or via PostGIS)
  → Returns instantly

Admin clicks "Refresh Prices" (or cron)
  → Calls fuel-finder edge function with mode: "refresh"
  → Edge function fetches all GOV.UK data
  → Upserts into fuel_station_cache
  → May still timeout, so we'll fetch stations+prices in parallel
     and add early-return resilience
```

### Files to change

1. **New migration** — create `fuel_station_cache` table
2. **`supabase/functions/fuel-finder/index.ts`** — add `refresh` mode that writes to DB; for `depot`/`route` modes, read from `fuel_station_cache` instead of calling the external API
3. **`src/pages/FuelFinderPage.tsx`** — query `fuel_station_cache` directly for searches; add admin "Refresh Prices" button; show cache freshness

### Key details
- The refresh can fetch stations and prices with separate tokens in parallel to cut time in half
- Even if refresh times out, partial data will be cached (upsert per batch)
- Search queries become instant since they just read from Supabase
- Cache freshness shown to users: "Prices last updated: 2 hours ago"

