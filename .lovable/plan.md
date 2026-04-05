

## Fuel Finder Page with Two Modes + Admin Fuel Card Price

### Overview
A new page accessible to all authenticated users with two search modes and an admin-managed fuel card price for cost comparison.

### Two Search Modes

**Mode 1: "Start from Depot"**
- Uses the existing depot coordinates (B10 0AD)
- Calls the Fuel Finder API to find diesel stations within 5 miles
- Shows results sorted by price, highlighting cheapest and most recently updated

**Mode 2: "On My Route"**
- User enters current location and destination (text inputs, geocoded via Geoapify)
- Edge function calculates a rough corridor between the two points
- Returns diesel stations within ~2 miles of the straight-line route
- Same display: sorted by price with highlights

### Admin Fuel Card Price
- New DB table `fuel_card_settings` with columns: `id`, `price_per_litre` (numeric), `updated_at`, `updated_by`
- Admin-only section at the top of the page to set/update the fuel card price (pence per litre)
- When viewing results, if any station's diesel price is higher than the fuel card price, show a badge: "Use fuel card instead"
- If all stations are more expensive, show a prominent banner recommending the fuel card

### Database Migration
```sql
CREATE TABLE public.fuel_card_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_per_litre numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.fuel_card_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "fuel_card_select" ON public.fuel_card_settings
  FOR SELECT TO authenticated USING (true);

-- Only admins can insert/update
CREATE POLICY "fuel_card_insert" ON public.fuel_card_settings
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY "fuel_card_update" ON public.fuel_card_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));
```

### Edge Function: `fuel-finder`
- Accepts `mode` parameter: `"depot"` or `"route"`
- For `"depot"`: uses hardcoded depot lat/lon, 5-mile radius
- For `"route"`: accepts `origin_lat/lon` and `destination_lat/lon`, samples points along the line, filters stations within ~2 miles of any sample point
- Authenticates with GOV.UK Fuel Finder API via OAuth client credentials
- Filters to diesel (B7) fuel type only
- Returns: station name, brand, address, postcode, diesel price (ppl), last updated timestamp, distance from depot/route

### Secrets Required
- `FUEL_FINDER_CLIENT_ID` — provided by user
- `FUEL_FINDER_CLIENT_SECRET` — provided by user

### Frontend: `src/pages/FuelFinderPage.tsx`
- Radio group toggle: "Start from Depot" / "On My Route"
- **Depot mode**: single "Find Fuel" button, immediate results
- **Route mode**: two text inputs (current location, destination) + "Find Fuel" button; geocodes both via Geoapify before calling edge function
- Results displayed as cards sorted by price:
  - Green highlight on cheapest station
  - Blue highlight on most recently updated
  - Red "Use fuel card" badge on stations more expensive than fuel card price
- Admin section (visible only to admins): input field to set fuel card price (ppl) with save button
- Shows current fuel card price to all users if set

### Route & Navigation
- Add `/fuel-finder` to `App.tsx` as a `ProtectedRoute` (no `adminOnly`)
- Add "Fuel Finder" link with `Fuel` icon in `Layout.tsx` nav for all authenticated users (not just admin)

### Files
1. New migration SQL (fuel_card_settings table + RLS)
2. New secrets: `FUEL_FINDER_CLIENT_ID`, `FUEL_FINDER_CLIENT_SECRET`
3. New edge function: `supabase/functions/fuel-finder/index.ts`
4. New page: `src/pages/FuelFinderPage.tsx`
5. Modified: `src/App.tsx` — add route
6. Modified: `src/components/Layout.tsx` — add nav link

