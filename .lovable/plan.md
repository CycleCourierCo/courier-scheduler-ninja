# Copy addresses in the Get Timeslots stop list

## Problem
On the Get Timeslots route planner, every stop card is draggable as a whole, so pressing on the address starts a drag (move cursor) instead of letting you select and copy the address text.

## Fix
Keep drag-and-drop working as before, but stop it from starting when the press begins on the address text.

1. **`src/hooks/useDraggable.tsx`** — when the mouse goes down on an element marked `data-nodrag` inside the draggable card, temporarily set the card's `draggable` to false, and restore it on mouseup. This lets text selection work normally there while dragging everywhere else on the card stays exactly as it is.

2. **`src/components/scheduling/RouteBuilder.tsx` (JobItem stop card)** — mark the address paragraphs with `data-nodrag` and give them a text cursor plus `select-text` so they read as copyable:
   - the single-job address line
   - the grouped ("Multiple stops") address line
   - the "Final destination" lines for foam/box jobs

3. **Card cursor** — change the card's `cursor-move` to a normal cursor (the grip handle keeps its grab cursor), so clicking the address no longer shows the move icon.

## What stays the same
- Dragging a stop to reorder it still works anywhere on the card except the address text.
- The typed position box, WA button, and everything else on the card are unchanged.

## Verification
- Build check via the dev server logs.
- Signed-in check is with the user (external sign-in): open Get Timeslots, click-drag across an address to select it, copy it, and drag a stop by its body or grip to confirm reordering still works.
