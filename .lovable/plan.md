

## Plan: Daily Price Cache Cron Job + Multiple Fuel Cards

### 1. Daily Cron Job for Fuel Price Cache Refresh

**Database migration**: Create a `SECURITY DEFINER` wrapper function `invoke_fuel_finder_refresh()` that calls the existing `fuel-finder` edge function with `mode: "refresh"` and a cron secret header. Schedule it via `pg_cron` to run daily at 5:00 AM.

**Edge function update** (`supabase/functions/fuel-finder/index.ts`): Add authentication to the refresh endpoint — accept either admin JWT or `X-Cron-Secret` header (using the existing `requireAdminOrCronAuth` pattern from `_shared/auth.ts`). Search requests remain open to any authenticated user.

**Config update** (`supabase/config.toml`): Add `[functions.fuel-finder]` with `verify_jwt = false` (auth handled in code).

### 2. Multiple Fuel Cards Admin Settings

**Database migration**: Create a new `fuel_cards` table replacing the single-row `fuel_card_settings`:
```
fuel_cards (
  id uuid PK default gen_random_uuid(),
  card_name text NOT NULL,          -- e.g. "Shell Fuel Card", "BP Plus"
  price_per_litre numeric NOT NULL, -- in pence
  is_active boolean default true,
  updated_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```
RLS: Admin full CRUD, authenticated users SELECT.

Keep the existing `fuel_card_settings` table as-is (no migration needed to remove it — just stop using it in code).

### 3. Frontend Changes (`src/pages/FuelFinderPage.tsx`)

**Admin section**: Replace the single fuel card price input with a card management UI:
- List all fuel cards with name, price, and active toggle
- "Add Fuel Card" button with name + price fields
- Edit/delete existing cards
- Each card shows last updated time

**Comparison logic**: Instead of comparing against a single `cardPrice`, compare station prices against the **cheapest active fuel card**. Show the card name in warnings (e.g. "Use your Shell Card instead at 139.9p").

**Non-admin view**: Show all active fuel cards with their prices instead of a single price.

### Files to Change
- `supabase/functions/fuel-finder/index.ts` — add cron/admin auth for refresh mode
- `supabase/config.toml` — add fuel-finder function config
- `src/pages/FuelFinderPage.tsx` — multiple fuel cards UI + updated comparison logic
- Database migration — `fuel_cards` table + cron job setup

