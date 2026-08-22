# Clean up the Bike Brands Distribution chart

## What's actually wrong

Verified against the live data:

- 6,630 orders produce **854 distinct brand strings**, 554 of which appear exactly once.
- Everything past the top 9 gets dumped into one "Other" slice — that's the **4,182** slice you're seeing. It isn't a real category, it's the long tail plus junk.
- Casing duplicates split real brands: `Trek` (417) + `TREK` (157), `Cube` (276) + `CUBE` (41), `Orbea` (128) + `ORBEA` (72), `Specialized` (519) + `specialized` (40).
- 135 orders carry placeholders like "Multiple bikes" instead of a brand.
- The chart counts one row per order using the flat `bike_brand` field, so multi-bike orders count once and per-bike brands in the `bikes` snapshot are ignored.

## What changes

**Normalisation before charting**
- Case- and punctuation-insensitive grouping, displayed with a canonical label (so `TREK`/`trek`/`Trek` all become "Trek").
- Strip trailing noise: extra whitespace, trailing punctuation, and common suffixes (e.g. "Bikes", "Cycles").
- An alias map for known variants (Specialized/Specialised, Santa Cruz/Santacruz, Cannondale misspellings, Whyte, Genesis, etc.), easy to extend.
- Placeholder values ("Multiple bikes", "Unknown", "N/A", "-", "Order 1", "Bike 1", blanks) are excluded from brands and reported separately as an "Unspecified" count under the chart rather than as a pie slice.

**Counting**
- Count per bike from the `bikes` snapshot when present (source of truth), falling back to the flat `bike_brand` field for older orders, so multi-bike orders contribute the right number of bikes.

**Chart presentation**
- Switch the pie to a horizontal bar chart of the top brands (readable labels, no overlapping pie text; the current pie labels are unusable at 360px wide).
- A "Top N" control (10 / 20 / 50 / All) instead of a hardcoded 9.
- The tail becomes "Other brands (N brands)" so it's obviously a bucket, not a brand, and it's tinted differently. A footer line shows: total bikes, distinct brands after cleaning, brands in the tail, and unspecified count.
- Hovering a brand shows bike count and share of all bikes with a brand.

## Technical notes

- New `src/lib/brandNormalise.ts`: `canonicalBrand(raw)` returning `{ key, label }` or `null` for placeholders, plus the alias table and placeholder set.
- `getBikeBrandAnalytics` in `src/services/analyticsService.ts` rewritten to iterate `order.bikes` (fall back to `bikeBrand` × `bikeQuantity`), aggregate by canonical key, and return `{ brands, totalBikes, unspecifiedCount, distinctBrands }`.
- `src/components/analytics/BikeBrandsChart.tsx` rewritten as a `recharts` `BarChart` (vertical layout) with a top-N `Select`, using existing chart tokens; mobile-safe heights.
- `src/pages/AnalyticsPage.tsx` updated for the new return shape. No database or schema changes — this is display-layer cleaning only, source data stays untouched.
