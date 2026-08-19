# Manual times + move up/down on the Get Timeslots popup

Two additions to the Route Timeslots popup (Job Scheduling > Route Builder), on both desktop dialog and mobile drawer.

## 1. Editable stop times

- Each stop's time badge becomes an editable time field (small `time` input, keeps the clock icon look).
- Typing a new time for a stop sets that stop's time, then re-times every later stop from that point using the existing route engine (same travel-time logic used by Recalculate), so downstream arrivals stay realistic.
- Earlier stops and the route start time are untouched.
- Breaks in the sequence keep their durations when later stops are re-timed.
- For a grouped stop (multiple jobs at the same location), the edited time applies to every job in that group.
- Route summary (end ETA, length) refreshes after the edit.

## 2. Up / Down buttons

- Each stop gets small chevron up and chevron down buttons next to the existing drag handle.
- Up moves the stop above the one before it; Down moves it below the one after it. Drag-and-drop stays exactly as it is.
- Up is disabled on the first stop, Down on the last.
- Moving a grouped stop moves all its jobs together, so a group never gets split.
- After a move, stop numbers renumber and times are recalculated for the new sequence, same as a drag reorder does today.

## Technical notes

- File: `src/components/scheduling/RouteBuilder.tsx`.
- `JobItem` gains `onUpdateTime(job, time)` and `onMove(index, direction)` props; the parent already owns `selectedJobs`, `reorderJobs`, and the timeslot calculation, so both handlers live next to `reorderJobs`.
- Manual re-time reuses the existing arrival-time computation path used by `refreshAndCalculateTimeslots`, seeded from the edited stop's time instead of `startTime`, and writes back `estimatedTime` on the affected jobs.
- `onMove` wraps `reorderJobs` with group-aware index maths (jobs sharing a `locationGroupId` move as one block).
- No database or edge function changes; sending timeslots continues to read `estimatedTime`, so manual times are what gets sent to customers and Shipday.
