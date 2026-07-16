## Changes to `src/pages/BicycleInspections.tsx`

**1. Stack status tabs vertically on mobile**
- Remove the horizontal-scroll wrapper on the status `TabsList`.
- Change tabs container to a grid on mobile so each status sits on its own row, switching to inline wrap on `sm+`:
  - `TabsList` classes → `grid w-full grid-cols-1 gap-1 h-auto sm:flex sm:flex-wrap`
  - Each `TabsTrigger` → `w-full justify-start sm:w-auto sm:justify-center`
- Drop the `overflow-x-auto` / `min-w-max` / `flex-nowrap` classes added previously since tabs no longer need to scroll sideways.

**2. Hide "Create Invoice" when inspection total is £0**
- Where the Create Invoice button is rendered on a completed inspection, wrap it in a condition that also checks the computed total (sum of `labour_price_gbp + parts_price_gbp` across issues/actions, matching the total already displayed on the card).
- Condition becomes: `status === 'completed' && !inspection.invoice_id && total > 0` (keeping existing guards).
- If an invoice already exists, continue to show the "View Invoice" link as today (unchanged).

No backend, pricing, or data changes. Desktop layout for tabs remains a wrapped row; only mobile switches to stacked.