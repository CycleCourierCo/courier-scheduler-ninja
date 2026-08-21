# PDI-style bike inspection form

Replace the current four-tick checklist with a grouped pre-delivery inspection (PDI) sheet — more thorough, still quick to complete on a phone.

## New structure

Items are grouped into collapsible sections, each item rated with one tap:

- **Pass** (OK), **Advisory** (worn, note it), **Fail** (needs repair)

Sections and items:

```text
Frame & forks       frame condition, forks/headset, paint/crash damage
Wheels & tyres      wheel true/spokes, hubs/bearings, tyre tread, tyre pressure set
Brakes              pads/rotors or blocks/rims, lever feel, cable/hose condition
Drivetrain          chain wear, cassette/chainrings, gear shifting/indexing, cranks & BB
Contact points      bars/stem, seatpost & saddle, pedals, all bolts torqued
Extras              lights/mudguards/rack, accessories present, bell/reflectors
Electric (e-bikes)  battery condition & charge, mount/latch, motor & assist levels, display/errors, key present, charger supplied
Finishing           lubed, cleaned, test ridden
```

Electric section only appears for electric categories (unchanged rule), and its answers clear if the category switches away.

## Behaviour

- Default state is unanswered; Confirm stays disabled until every visible item is rated.
- **Quick pass** button per section marks all its items Pass, for speed.
- Advisory and Fail both open a note field. Fail additionally prompts "Report issue" (the existing repair picker, parts/labour pricing, part details and in-stock tick — unchanged).
- Each section shows a small counter (e.g. "6 pass · 1 advisory · 1 fail") and the header shows overall progress.
- Optional free-text "General notes" box at the bottom, plus test-ride confirmation.
- On confirm:
  - Any Fail with an issue → same flow as today (issues submitted, order moves into pricing).
  - No issues → order marked inspected as today, but the saved notes are a structured PDI summary listing every item with its result and any note (advisories included), so advisories are visible on the order without becoming chargeable repairs.

## Technical notes

All in `src/pages/BicycleInspections.tsx` (no DB or service changes — results are captured in the existing inspection `notes` text and issues):

- Replace `INSPECTION_ITEMS` / `ELECTRIC_INSPECTION_ITEMS` with an `INSPECTION_SECTIONS` array of `{ id, title, electricOnly?, items: { id, label }[] }`, plus a flattened `activeItems` derived from `isElectricCategory(checklistBikeType)`.
- Swap `inspectionChecklist: Record<string, boolean>` for `Record<string, 'pass' | 'advisory' | 'fail'>`; `allItemsChecked` becomes "every active item has a result". Keep `inspectionComments` and `checklistIssues` keyed by item id so the existing issue handlers and `[label] description` prefixing work unchanged.
- Reuse the existing electric-strip effect, extended to strip all items in electric-only sections.
- Render sections with the existing `Accordion` primitive; ratings as a three-button toggle group sized for touch.
- Notes builder produces lines like `PASS  Chain wear`, `ADVISORY  Tyre tread: ~20% left`, `FAIL  Rear pads: metal to metal`, grouped under section headings, followed by general notes.
