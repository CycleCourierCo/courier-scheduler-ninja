# Add bike details tooltip to route timeslot bike-count badge

## Goal
When hovering over the bike-count badge (e.g. "🚲 1/10") on jobs in the Route Timeslots drawer, show the bike type, brand, and model for that order.

## What will change
- `src/components/scheduling/RouteBuilder.tsx`
  - Import `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` from `@/components/ui/tooltip` and `getGroupedBikes` from `@/utils/bikeSummary`.
  - Wrap both bike-count badges (single job and grouped-location job rows) in a `Tooltip`.
  - Build tooltip content from `getGroupedBikes(job.orderData)` showing: quantity × brand + model + type.
  - If no bikes snapshot is present, fall back to legacy `bikeBrand`/`bikeModel`/`bikeType` fields.
- Ensure a `TooltipProvider` wraps the route builder content (add at component root if not already present higher up).

## Out of scope
- No changes to van capacity calculations or space weighting.
- No changes to the MultiJobTimeslotDialog unless the same badge pattern exists there.

## Verification
- Open the route timeslot drawer on a route with one or more jobs.
- Hover over the bike-count badge and confirm a tooltip appears listing each bike's type, brand, and model.
- Test with both legacy single-bike orders and multi-bike orders.
