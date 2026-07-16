## Fix mobile overflow in the Bike Inspection dialog

The dialog on mobile (360px) is wider than the viewport, cutting off the left side of every row. Root cause: shadcn `DialogContent` uses `grid w-full max-w-lg` — grid tracks default to `min-content`, so any long unbreakable child (the RepairPicker button label "Rim brake inner/outer cable replacement (per brake, external)", the workshop-rate helper text, the Textarea, etc.) forces the whole grid to expand past 100vw. `p-6` on mobile also eats ~48px.

### Changes (frontend/presentation only, scoped to the checklist dialog + RepairPicker)

1. `src/pages/BicycleInspections.tsx` — Inspection Checklist `<DialogContent>` (line 1721):
   - Replace class with `w-[calc(100vw-1rem)] sm:w-full max-w-lg p-4 sm:p-6 max-h-[85vh] overflow-y-auto` plus `[&>*]:min-w-0` so grid tracks can shrink.
   - Inner wrapper `space-y-4 py-4` → add `min-w-0`.
   - Each issue card (`p-3 bg-muted/50 …`) → add `min-w-0 overflow-hidden` and drop internal `p-3` to `p-2 sm:p-3` on mobile.
   - `grid grid-cols-2 gap-2` for Parts/Labour → keep, but wrap each `<Input>` parent with `min-w-0` so numeric inputs shrink.
   - Checklist item wrapper (`space-y-3 p-3 border rounded-lg`) → `p-2 sm:p-3 min-w-0`.
   - Reduce left indent `ml-7` → `ml-4 sm:ml-7` to give issue cards more room.

2. `src/components/inspections/RepairPicker.tsx`:
   - Trigger button: add `min-w-0` on the outer `<Button>` and on the inner label `<span>` (`flex items-center gap-2 truncate min-w-0`) so the truncate actually engages inside the flex row.
   - `PopoverContent` width: `w-[calc(100vw-1rem)] sm:w-[420px] sm:max-w-[92vw]` so the popover itself never overflows on mobile.

3. No changes to logic, data flow, services, or the pricing/edit forms outside the checklist dialog. Card-level RepairPicker usages (lines 1061, 1321) inherit the RepairPicker fix automatically.

### Out of scope
- No changes to `src/components/ui/dialog.tsx` (shared component).
- No changes to inspection data model, submission flow, or the labour-times catalogue.
- Desktop layout is preserved (all mobile-only tweaks are behind `sm:` breakpoints).
