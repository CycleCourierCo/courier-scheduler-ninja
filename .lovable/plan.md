

# Fix Scrolling in Route Comparison Dialog

## Problem

The Route Comparison dialog prevents scrolling when there are many routes to compare. The `DialogContent` uses `overflow-hidden` which blocks native scrolling, and the `ScrollArea` component inside may not be expanding correctly within the flex layout.

## Fix

### File: `src/components/scheduling/RouteComparisonDialog.tsx`

Remove `overflow-hidden` from the `DialogContent` className and ensure the `ScrollArea` properly fills available space by giving it an explicit max-height. Replace the current flex-based approach with a simpler `ScrollArea` that has a calculated max height to ensure the content scrolls within the dialog.

- Change `DialogContent` className from `max-w-2xl max-h-[85vh] overflow-hidden flex flex-col` to `max-w-2xl max-h-[85vh] flex flex-col`
- Add an explicit `max-h` style to the `ScrollArea` (e.g., `className="flex-1 -mx-6 px-6 overflow-auto"`) so it properly scrolls within the dialog bounds

This is a one-line className tweak -- removing `overflow-hidden` so the `ScrollArea` can scroll as intended.

