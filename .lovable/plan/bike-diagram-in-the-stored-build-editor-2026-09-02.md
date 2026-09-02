# Bike diagram in the stored build editor

Add the bike diagram to the "Parts needed" section of the stored build dialog so you can see at a glance which areas of the bike the spec already covers.

## What changes

- The Edit/New stored build dialog shows the same bike outline used elsewhere, directly above the parts list.
- Each area shows the number of parts on the spec that belong to it, so covered areas read as ticked off (highlighted with a count) and empty areas stay plain.
- Tapping an area filters the parts list below to just the parts in that area, with a "Show all parts" toggle to clear the filter.
- Tapping an area when nothing on the spec matches it adds a new blank part row pre-set to that area, so you can build the spec straight off the diagram.
- Part rows keep their existing category dropdown, quantity, spec-notes field and delete button; the category dropdown stays the source of truth for which area a part lands in.

## Technical notes

- `src/components/build-my-bike/BuildTemplateDialog.tsx`: render `BikeDiagram` in the Parts needed block. Build `countsBySlot` by mapping each `form.items` entry through `slotForCategory(item.category)` and summing `quantity`.
- Keep a local `activeSlot` state; when set, render only items whose derived slot matches, tracking original indices so `setItem`/delete still target the right row.
- Reuse `slotForCategory` and `BIKE_HOTSPOTS` from `src/constants/bikeComponents.ts`; no service or database changes.
- Keep the dialog mobile-safe with the existing `max-w-[calc(100vw-2rem)]`/`min-w-0` guards used in the other build dialogs.
