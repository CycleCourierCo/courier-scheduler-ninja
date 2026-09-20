# Type a stop number to move a job to that position

## Goal
In the Route Timeslots popup, stops can be reordered by dragging or with the up/down arrows. Add a small number box on each stop so a planner can type "7" and that stop jumps straight to position 7.

## Behaviour

- The `#3` badge on each stop card becomes a small number input showing that stop's position.
- Typing a new number and pressing Enter (or clicking away) moves the stop to that position; everything else shifts around it.
- Numbers outside the valid range (below 1, above the number of stops) are ignored and the box snaps back to the current position.
- Grouped stops (several jobs at the same address) move together as one block, exactly like the arrows do today.
- After the move, stop numbers renumber and arrival times recalculate — the same as a drag or arrow move.
- The input is disabled while times are being recalculated, and typing in it does not start a drag.
- Works in both the desktop dialog and the mobile drawer.

## Technical notes

- File: `src/components/scheduling/RouteBuilder.tsx`.
- New parent handler `moveStopToPosition(index, targetPosition)` placed next to `moveStop`: reuses `getStopBlock` for group-aware slicing, removes the block, inserts it so its first job lands at the requested stop position, renumbers `order`, then calls `calculateTimeslots(updated)`.
- Target position is expressed in *stop* terms (visible cards), so the handler maps the requested stop number to the underlying array index by walking distinct `locationGroupId`/single-job blocks — this keeps grouped stops counting as one.
- `JobItem` gains an optional `onMoveTo?: (index: number, position: number) => void` prop plus local input state seeded from `job.order`; passed from both render sites alongside `onMove`/`onUpdateTime`.
- Input handlers call `e.stopPropagation()` and the card keeps its existing drag behaviour.

## Verification
- `bun run build`.
