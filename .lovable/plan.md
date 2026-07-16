## Goal

1. When pricing an inspection issue, capture **parts price** and **labour price** separately (not just one total).
2. On the Analytics page, show **average labour spend per bike** and **average parts spend per bike**.
3. On the Route Profitability page, split mechanic revenue into **total revenue**, **labour revenue**, and **labour profit** (labour revenue − full mechanic wage cost).

Existing priced issues stay as-is (legacy `estimated_cost` only, no parts/labour split). New/re-priced issues get the split. Analytics averages only use rows with the split populated.

---

## 1. Database migration

Add two columns on `inspection_issues`:
- `parts_cost numeric` (nullable)
- `labour_cost numeric` (nullable)

Keep `estimated_cost` as the source of truth for totals (= parts + labour when split, or legacy single value). A trigger keeps `estimated_cost = coalesce(parts_cost,0) + coalesce(labour_cost,0)` whenever either split field is set on insert/update. Legacy rows untouched.

No RLS/grant changes (existing table).

## 2. Pricing UI (`src/pages/BicycleInspections.tsx`)

Replace the single "Price (£)" input in the awaiting-pricing block (~line 851) with two inputs side by side:
- Parts (£)
- Labour (£)
- Small read-only total shown next to Save

Save button submits both values; total = parts + labour goes into `estimated_cost` for backward compatibility with existing totals, receipts, invoices, and profitability queries. Also updates the edit form (~line 885/979) similarly.

`setPriceInputs` state becomes `{ [issueId]: { parts: string; labour: string } }`. `setIssuePrice` service (and the admin edit path that writes `estimated_cost`) gains optional `partsCost` / `labourCost` params and writes all three fields together.

## 3. Analytics page (`src/pages/AnalyticsPage.tsx` + `src/services/inspectionAnalyticsService.ts`)

Extend `inspectionAnalyticsService`:
- Select `parts_cost, labour_cost` alongside `estimated_cost`.
- For approved issues where both `parts_cost` and `labour_cost` are non-null, compute:
  - `avgPartsPerBike` = sum(parts_cost) / count(distinct inspection_id with split rows)
  - `avgLabourPerBike` = sum(labour_cost) / count(distinct inspection_id with split rows)
- Include a `splitCoverage` count so the UI can note "based on N of M priced bikes" when legacy rows exist.

Add two new stat cards in the inspection analytics section on `AnalyticsPage.tsx`:
- "Avg Parts / Bike" £X.XX
- "Avg Labour / Bike" £X.XX
Both with a small caption showing coverage when < 100%.

## 4. Route Profitability page (`src/components/analytics/MechanicProfitabilityPanel.tsx` + `src/services/mechanicProfitabilityService.ts`)

Extend `MechanicProfitRow` with:
- `labourRevenue: number` — sum of `labour_cost` on resolved issues in range (falls back to 0 for legacy rows with only `estimated_cost`).
- `labourProfit: number` — `labourRevenue - wageCost` (full mechanic wage cost as chosen).

Update the query to select `labour_cost` too. Attribution rules unchanged (by `resolved_by_id`, in range).

In the panel:
- Add columns **Labour Revenue** and **Labour Profit** to the per-mechanic table (Labour Profit colour-coded green/red like existing profit).
- Add totals row / summary tiles at the top showing: Total Revenue, Labour Revenue, Labour Profit (existing Total Profit stays).
- Small footnote: "Labour revenue only counts issues priced with the parts/labour split."

## 5. No changes

- Invoicing/receipts continue to use `estimated_cost` totals.
- No changes to inspection status flow, parts-ordered/arrived logic, or bike delivery pricing.
- No changes to RouteBuilder or scheduling.

---

## Technical notes

- Trigger on `inspection_issues`:
  ```sql
  before insert or update of parts_cost, labour_cost on public.inspection_issues
  when (new.parts_cost is not null or new.labour_cost is not null)
  set new.estimated_cost = coalesce(new.parts_cost,0) + coalesce(new.labour_cost,0)
  ```
- Existing `allPriced` gate (`estimated_cost != null`) still works: legacy rows already priced remain priced; new rows become priced once either split field is entered (both default to 0 if blank, but Save requires at least one > 0).
- Types file (`src/integrations/supabase/types.ts`) regenerates after migration approval; only then update service + UI code.
