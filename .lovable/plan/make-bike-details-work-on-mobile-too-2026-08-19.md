# Make bike details work on mobile too

Right now the bike-count badge in the Route Timeslots view uses a hover tooltip. Hover only exists on desktop with a mouse, so on a phone or tablet tapping the badge shows nothing. The fix is to make the badge tappable on touch devices while keeping the hover behaviour on desktop.

## Changes

- Job Scheduling / Route Timeslots badge: on touch/small screens, tapping the bike-count badge opens a small popover listing each bike (quantity, brand, model, type); tapping outside closes it.
- On desktop, hovering keeps working exactly as it does today.
- Same content in both cases, so there is one source of truth for the bike list.

## Technical detail

- `src/components/scheduling/RouteBuilder.tsx`: in `BikeCountBadge`, use `useIsMobile()` from `src/hooks/use-mobile.tsx` to pick between the existing Radix `Tooltip` (desktop) and a Radix `Popover` (mobile). Extract the bike list JSX into a shared local variable used by both `TooltipContent` and `PopoverContent`.
- Keep the badge styling and overload colouring unchanged; add `aria-label` so the tap target is described for screen readers.
