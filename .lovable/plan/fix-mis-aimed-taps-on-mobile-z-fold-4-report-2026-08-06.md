# Fix mis-aimed taps on mobile (Z Fold 4 report)

A customer on a Galaxy Z Fold 4 reports that taps on the booking pages land in the wrong place: buttons need to be tapped slightly off-target, and when two controls sit close together the wrong one activates.

The cause is not yet confirmed, so step 1 is reproduction and measurement. No fix will be applied on guesswork.

## Step 1 — Reproduce and measure (first thing done)

Drive the real app in a headless browser at Z Fold 4 dimensions, with touch emulation and mobile device scale factor:

- Cover screen: 344 x 882
- Inner screen (folded open, portrait and landscape): 673 x 841 and 904 x 673

On the home page, the sign-in page and the Create Order flow (all three steps), collect:

- Document vs. viewport width (horizontal overflow makes the browser widen the layout viewport, which is a classic source of offset taps)
- Bounding boxes of every button, tab, switch and select, checking for boxes that overlap each other or extend beyond their visible pill
- Which element is actually at the centre point of each visible control (`elementFromPoint`), so any invisible layer sitting on top is identified by name
- Result of a real tap at each control's visual centre, confirming whether the intended handler fires

## Step 2 — Fix what the measurements show

Repairs will be applied only to what step 1 proves. The likely candidates already spotted in the code, each to be confirmed before changing:

- Decorative full-bleed layers (large blurred circles and a dark overlay in the page shell and hero) that are not marked as click-through, so they can swallow or steal taps
- Any container that overflows horizontally on a 344px-wide screen, which shifts the whole coordinate space
- Controls whose tap area is smaller than the 44px minimum or that sit with too little gap between them, which is exactly what makes a neighbouring button win the tap
- Hover-driven movement (lift/translate effects) that on touch devices can move a control after the finger goes down

## Step 3 — Verify

Re-run the same tap harness at all three fold viewports and confirm every control activates from its own visual centre, with screenshots of the Create Order steps as evidence. Then a quick pass on the other high-traffic customer pages (tracking, dashboard) at the cover-screen width.

## Technical notes

- Harness lives under `/tmp/browser/`, not in the project.
- Expected edits are presentation-only: `pointer-events-none` on decorative overlays, overflow containment, tap-target sizing and spacing utilities, and `touch-action`/hover-guard adjustments. No form logic, validation or order-creation behaviour changes.
- Files most likely touched: `src/components/Layout.tsx`, `src/pages/Index.tsx`, `src/pages/CreateOrder.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/button.tsx`, `src/index.css`.
