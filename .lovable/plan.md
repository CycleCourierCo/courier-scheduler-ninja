

## Add Invoice vs Route Profitability Comparison Section

### What it does
Adds a new collapsible section to the Route Profitability page (between Yearly chart and Settings) that lets you pick a date range and see side-by-side:
- **Invoice Revenue**: What was actually billed to customers (from `invoice_history`)
- **Route Revenue**: What route profitability estimates based on bike-type pricing
- **Route Costs**: Total driver costs from timeslips
- **True Profit**: Invoice revenue minus route costs
- Per-customer breakdown table showing invoiced amount, order count, and their share of total

### Implementation

**New file: `src/components/analytics/InvoiceVsCostComparison.tsx`**
- Date range picker (start date + end date) defaulting to the current month
- Queries `invoice_history` for overlapping date ranges
- Queries timeslips for the same period and calculates route revenue + costs using existing `aggregateProfitability` logic
- Summary cards: Total Invoiced, Route Revenue, Total Costs, True Profit (invoiced - costs), Margin %
- Per-customer breakdown table: customer name, invoiced amount, order count
- Bar chart comparing Invoice Revenue vs Route Revenue vs Costs

**Edit: `src/pages/RouteProfitabilityPage.tsx`**
- Import and render `InvoiceVsCostComparison` between the Yearly chart and Settings card
- Pass `costPerMile`, `revenuePerStop`, `useBikeTypePricing` as props so route revenue calculations are consistent

### Data sources (no new tables)
- `invoice_history`: `total_amount`, `order_count`, `customer_name`, `start_date`, `end_date`
- `timeslips` (via existing service functions): driver pay, van allowance, mileage, bike-type revenue

### Technical notes
- Invoice date overlap query: `start_date <= selectedEnd AND end_date >= selectedStart`
- Route revenue reuses existing `getTimeslipsForMonth` / `aggregateProfitability` for the selected period
- RLS on `invoice_history` is `user_id = auth.uid()`, so the admin who created the invoices will see them

