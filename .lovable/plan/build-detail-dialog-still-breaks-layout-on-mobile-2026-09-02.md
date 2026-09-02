# Build detail dialog still breaks layout on mobile

The previous width guards were not enough: the screenshot shows the build dialog rendering wider than the phone viewport, so the bike diagram is scaled up and cut off on the right, and the components list runs off screen. The exact element forcing the extra width is not yet confirmed, so the first step is to measure it rather than guess.

## Step 1 — Measure (no guessing)

Drive the preview with Playwright at a 360px viewport, open a build with components, and log the computed width of the dialog and each descendant whose `scrollWidth` exceeds the dialog's client width. That names the offending node (candidates: the `DialogContent` grid track, the stage/labour toolbar row, a component row, or the diagram wrapper).

## Step 2 — Fix the container so it can never exceed the viewport

In `src/components/ui/dialog.tsx` the dialog is a CSS grid with `w-full max-w-lg`; grid items default to `min-width: auto`, so any wide child stretches the track past the viewport. Apply, scoped to the build dialog rather than globally unless the measurement shows it is a base-component problem:

- Give the dialog's direct content wrapper `min-w-0` (and `w-full`) in `BuildDetailDialog.tsx` so long children can shrink.
- Replace the `w-[calc(100vw-2rem)]` guard with `max-w-[calc(100vw-2rem)]` so the dialog is bounded, not forced, at that width.
- Add `min-w-0` to the intermediate wrappers between the dialog and the truncating text (`space-y-5` block, `Components` section, each component row's flex parent).

## Step 3 — Make the content mobile-friendly

- Component rows: stack the value/actions under the name below `sm`, keep `truncate` with `min-w-0` on the text column so long specs like "Arow Race Frame - High modulus Toray T800…" clip instead of widening the row.
- Diagram wrapper: keep `overflow-hidden` and confirm the clamped hotspot labels sit inside at 360px.

## Step 4 — Verify

Re-run the same Playwright measurement and confirm no descendant exceeds the dialog width, no horizontal scrollbar exists at 360px, and a screenshot shows the full diagram plus complete component rows.
