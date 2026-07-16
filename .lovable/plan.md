## Goal

Add an admin-only Labour Times management page at `/admin/labour-times` that lets staff browse, edit, add, and delete workshop labour times, manage multipliers, and control the workshop hourly rate + minimum charge used to calculate prices from `labour_minutes`. Existing `inspection_issues` table and UI stay untouched.

## 1. Database (single migration)

**New table `public.workshop_settings`** — single-row config.
- `id int primary key check (id = 1) default 1`
- `hourly_rate_gbp numeric not null default 75`
- `min_charge_gbp numeric not null default 15`
- `updated_at timestamptz default now()`, updated_by uuid
- Grants: `select` to authenticated, all to service_role. RLS on. Policies:
  - Any authenticated user can `select`
  - Only `has_role(auth.uid(),'admin')` can `insert`/`update`
- Seed row `(1, 75, 15)`.

**Add write policies to `labour_times` and `labour_time_multipliers`** (currently read-only for authenticated). Admin-only insert/update/delete via `has_role(auth.uid(),'admin')`. Grants: `insert/update/delete` to `authenticated` (policy still gates by role).

**Helper for custom repair_id sequence**: `public.next_custom_repair_id()` returns `'CUS-' || lpad(nextval('public.custom_repair_id_seq')::text, 4, '0')`. Sequence starts at 1. Security definer, admin-only.

## 2. Shared pricing helper (`src/lib/labourPricing.ts`)

```ts
export function calculateLabourPrice(minutes: number, hourlyRate: number, minCharge: number): number {
  const raw = (minutes * hourlyRate) / 60;
  const rounded = Math.ceil(raw / 5) * 5;
  return Math.max(minCharge, rounded);
}
export function formatGBP(n: number): string { /* £X */ }
```

Also export a `useWorkshopSettings()` react-query hook that fetches the singleton row, cached 5 min. Used anywhere prices are displayed. This is additive — existing inspection pricing keeps using `estimated_cost` / `parts_cost` / `labour_cost` unchanged.

## 3. Service layer (`src/services/labourTimesService.ts`)

- `listLabourTimes({ page, pageSize, bikeType?, category?, skillLevel?, search? })` → uses `.range()` + `count: 'exact'` for server-side pagination + total. Search does `.or('repair_name.ilike.%q%,subcategory.ilike.%q%')`.
- `listFilterOptions()` → distinct `bike_type`, `category`, `skill_level` (one-shot, cached in react-query).
- `upsertLabourTime(row)`, `deleteLabourTime(id)`, `createCustomLabourTime(payload)` — calls RPC `next_custom_repair_id` then inserts.
- `listMultipliers()`, `upsertMultiplier(row)`, `deleteMultiplier(modifier)`.
- `getWorkshopSettings()`, `updateWorkshopSettings({ hourly_rate_gbp, min_charge_gbp })`.

## 4. Page + components

Route: `/admin/labour-times` in `App.tsx`, wrapped in `<ProtectedRoute adminOnly>`. New page `src/pages/LabourTimesAdmin.tsx` with the existing `Layout` shell.

Structure:

```
Settings Card (top)
  - Hourly rate £ input, Min charge £ input, Save button
  - Live preview: "e.g. 30 min job → £X"

Tabs
  - "Labour times" (default)
      Filters row: bike_type select, category select, skill_level select, search input (300ms debounce)
      DataTable (shadcn table + custom pagination):
        default cols: repair_id | bike_type | category | repair_name | minutes | price* | difficulty | skill | safety
        (*price computed live: calculateLabourPrice(minutes, rate, minCharge))
        column-visibility Popover for the rest
        "Add repair" button (top right) → opens dialog empty
        row click → edit dialog (all fields)
        row action menu: Edit / Delete (AlertDialog confirm)
      Pagination: 50/page, prev/next + "Page X of Y (N rows)"
  - "Multipliers"
      Simple editable table (all 18 rows, no pagination). Inline edit or per-row dialog.
      "Add multiplier" button.
```

Dialog (`src/components/labour-times/LabourTimeDialog.tsx`) uses react-hook-form + zod:
- text inputs for repair_id (disabled on edit; auto-generated CUS-#### on add via RPC), bike_type, category, subcategory, repair_name, specialist_tools, common_parts, notes
- number inputs for labour_minutes, min_charge_gbp, combined_saving_minutes
- Select for difficulty_1_5 (1-5), skill_level (4 options)
- Switch for each Yes/No field (combinable, safety_critical, warranty_eligible, test_ride_required, torque_check_required, software_calibration_required, suspension_setup_required, brake_bed_in_required) — mapped to 'Yes'/'No' text on save
- Live "Estimated price: £X" using current settings

Multiplier dialog: modifier, adjustment_type (select percent/minutes), value (int), applies_to, notes.

## 5. Nav entry

Add a "Labour Times" link (admin-only) to the existing admin nav — will follow whatever pattern `DashboardHeader` / sidebar currently uses (need to check). If admin nav is auto-driven, add there; otherwise add a link where `/vehicles`, `/holidays`, etc. sit.

## 6. Not changed

- `inspection_issues` schema, triggers, `estimated_cost` sync, and `BicycleInspections.tsx` UI: untouched.
- Analytics + profitability panels: untouched.
- No bulk rewrite of `min_charge_gbp` on rate change — price is always derived at display time via `calculateLabourPrice`.

## Technical notes

- 3,548 rows: MUST use `.range((page-1)*50, page*50-1)` with `{ count: 'exact' }` — never `select('*')` without range.
- Filter dropdowns: `select('bike_type').order('bike_type')` then dedupe client-side (bike_type has limited values). Cache 10 min.
- Search: single trimmed term, min 2 chars, reset to page 1 on filter/search change.
- Custom repair_id sequence: RPC avoids race conditions vs. computing max client-side.
- All admin-only mutations gated both by RLS (`has_role`) and by `ProtectedRoute adminOnly`.
- `useWorkshopSettings` invalidated after settings save so prices refresh app-wide.
