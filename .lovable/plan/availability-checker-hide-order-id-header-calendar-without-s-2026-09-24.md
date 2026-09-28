# Availability checker: hide order ID header + calendar without scrolling

## Problem
1. The availability pages show the raw order UUID under the "Collection availability" / "Delivery availability" heading.
2. On mobile the calendar is cut off (only Mon–Fri visible) and needs horizontal scrolling — day cells are a fixed 44px wide inside an `overflow-x-auto` box, which is wider than the card on small screens.

## Changes

### 1. Hide the order ID (`SenderAvailability.tsx`, `ReceiverAvailability.tsx`)
- Remove `reference={params.id}` from every `<DoorstepShell ...>` usage in both pages (all states: error, loading, confirmed, options, form).
- No other page is affected — TrackingPage, InspectionApproval, RepairOffer, etc. keep their reference display.

### 2. Calendar fits without scrolling (`src/components/availability/AvailabilityForm.tsx`)
- Replace the `overflow-x-auto` wrapper with a plain bordered container so nothing scrolls sideways.
- Pass responsive class overrides to the calendar so cells flex to the available width instead of fixed 44px:
  - `head_cell`: `flex-1` (was `w-11`)
  - `cell`: `flex-1` (was `w-11`), keep height/tap target
  - `day`: `w-full` (was `w-11`)
- The calendar then always spans the full card width — 7 columns visible on any phone, same look on desktop.

## Verification
- Typecheck passes.
- Playwright screenshot of the availability page at 360px width: no UUID under the heading, calendar shows Mon–Sun with no horizontal scrollbar.
