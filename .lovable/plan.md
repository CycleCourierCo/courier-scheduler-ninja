
# Make Shipday Cross Icon a Clickable "Add to Shipday" Button

## Overview

Turn the red X icon (shown when a job is missing from Shipday or not synced) into a clickable button that calls `createShipdayOrder` to add that specific job to Shipday -- the same logic used on the Order Detail page.

## Changes

### File: `src/components/scheduling/RouteBuilder.tsx`

1. **Import `createShipdayOrder`** from `@/services/shipdayService`

2. **Add a handler function** `handleAddToShipday(orderId, jobType)` that:
   - Calls `createShipdayOrder(orderId, jobType)`
   - Shows a success/error toast
   - Triggers `onReVerifyShipday` to refresh verification status after adding

3. **Update `renderShipdayIcon`** (or the rendering site at line ~2447):
   - For `'verified'` status: keep the green checkmark as-is (non-clickable)
   - For `'missing'` or `'none'` status: wrap the icon in a small clickable button that calls `handleAddToShipday` with the correct `orderId` and job type (`'pickup'` or `'delivery'`)
   - Add a loading state per-job to show a spinner while the Shipday call is in progress
   - Use `e.stopPropagation()` to prevent the click from toggling the job card selection

4. **Pass order context to renderShipdayIcon**: The render function will need the `orderId` and `jobType` so it can trigger the correct Shipday call. This means changing the call site from `renderShipdayIcon(shipdayStatus)` to include `orderId` and `jobType` parameters.

## Technical Details

- Reuses the existing `createShipdayOrder` function from `shipdayService.ts` -- identical to the Order Detail page
- After a successful add, triggers re-verification so the icon updates to a green checkmark
- `e.stopPropagation()` prevents the button click from selecting/deselecting the job card
- A local `Set` state tracks which jobs are currently being synced (to show individual loading spinners)
