## Fix: dropdown lists in inspection pickers won't scroll on mobile

**Problem:** The `RepairPicker` and `BikeCategoryPicker` popovers use Radix `ScrollArea` for the list. Radix `ScrollArea` renders its own custom scrollbar and, on touch devices, the viewport frequently doesn't respond to finger scrolling inside a Popover — which is what the user is hitting on mobile.

**Change:** Replace `ScrollArea` with a plain scroll container that works natively with touch.

### `src/components/inspections/RepairPicker.tsx`
- Remove the `ScrollArea` import and wrapper around the results list.
- Replace `<ScrollArea className="h-72">…</ScrollArea>` with `<div className="max-h-72 overflow-y-auto overscroll-contain">…</div>`.

### `src/components/inspections/BikeCategoryPicker.tsx`
- Remove the `ScrollArea` import and wrapper around the options list.
- Replace `<ScrollArea className="h-64">…</ScrollArea>` with `<div className="max-h-64 overflow-y-auto overscroll-contain">…</div>`.

No other behavior changes — same height, same content, just native scrolling so touch drag works inside the popover.
