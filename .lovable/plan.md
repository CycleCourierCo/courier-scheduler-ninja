# Merge Customers and Business analytics into one tab

The analytics page currently has separate "Customers" and "Business" tabs that duplicate the same B2B vs B2C chart. Combine them into a single "Customers" tab.

## What changes

- Remove the "Business" tab trigger; keep a single "Customers" tab (10 tabs become 9).
- The combined tab shows, in order:
  - B2B vs B2C orders
  - Part exchange orders
  - Payment required on delivery
  - Top customers
  - B2B leaderboard
- The duplicated B2B vs B2C chart appears once.
- Anyone landing on the page with the old `business` tab selected is shown the Customers tab instead.

## Technical notes

Single file: `src/pages/AnalyticsPage.tsx`.

- Delete the `business` `TabsTrigger` and its `TabsContent`; move `paymentRequiredData` chart and `B2BLeaderboard` into the `customers` content with section headings ("Customer Mix", "Top Customers", "Business Customers") separated by `Separator`.
- Adjust `TabsList` grid to `lg:grid-cols-9`.
- Normalise `activeTab`: if it resolves to `business`, fall back to `customers` so existing state/deep links don't render an empty panel.
- No data/service changes; `b2bCustomers`, `customerTypeData`, `paymentRequiredData` stay as-is.
