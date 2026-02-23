## Create B2B Pricing Page

A new pricing page at `/pricing` that is only accessible to logged-in B2B customers (and admins). It will display all the delivery pricing information in a clean, professional layout.

### Files to Create

**1. `src/pages/PricingPage.tsx**`

- New page component wrapped in `<Layout>`
- Uses `useAuth()` to check the user's role
- If the user is not a B2B customer or admin, redirects to `/dashboard`
- Displays pricing in a structured card-based layout with the following sections:
  - **Header**: "Collection in Mainland England and Wales" with "Fully Insured" badge
  - **Standard Delivery Prices** (table/grid of bike types and prices):
    - Boxed Kids Bikes: GBP 35 + VAT
    - Wheelset/Frameset: GBP 35 + VAT
    - Kids Bikes: GBP 40 + VAT
    - BMX Bikes: GBP 40 + VAT
    - Bike Rack: GBP 40 + VAT
    - Turbo Trainer: GBP 40 + VAT
    - Folding Bikes: GBP 40 + VAT
    - Non-Electric Bikes: GBP 60 + VAT
    - Travel Bike Boxes: GBP 60 + VAT
    - Electric Bikes under 25kg: GBP 70 + VAT
    - Electric Bikes over 25kg: GBP 130 + VAT
    - Longtail Cargo Bikes: GBP 130 + VAT
    - Stationary Bikes: GBP 70 + VAT
    - Tandem Bikes: GBP 110 + VAT
    - Recumbent: GBP 130 + VAT
    - Small Trike:  GBP 150 + VAT
    - Large Trike: GBP 180 + VAT
    - Double Seat/Platform/Cargo Trikes: GBP 225 + VAT
  - **Scotland**: "Prices coming soon!"
  - **Additional Services** section:
    - Inspect, clean and service: GBP 60 + VAT
    - Exact date deliveries: Price on request
    - Channel Islands and Scotland deliveries: Price on request

### Files to Modify

**2. `src/App.tsx**`

- Import `PricingPage`
- Add route `/pricing` wrapped in `<ProtectedRoute>` (no special flags needed -- the page itself handles B2B-only access)

**3. `src/components/Layout.tsx**`

- Add a "Pricing" navigation link visible only to B2B customers (using the existing `isB2B` variable)
- Add it in both mobile sheet nav and desktop dropdown menu, alongside existing B2B-specific links like "Bulk Availability"

### Access Control

- The route uses `<ProtectedRoute>` to ensure the user is authenticated
- The page component checks `userProfile.role` and redirects non-B2B/non-admin users
- B2B customers with `account_status !== 'approved'` are already blocked by `ProtectedRoute`