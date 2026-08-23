# Fix overlapping review tabs on mobile

On the review detail page the five tabs (Self-assessment, Manager assessment, Meeting & objectives, Employee response, History) are set to wrap onto multiple lines, but the tab bar keeps its fixed single-row height. The wrapped rows spill out of the bar and sit on top of the tab content underneath, which is what the screenshot shows.

## What changes

- The tab bar becomes a single-row, horizontally scrollable strip on small screens: tabs stay on one line, you swipe sideways to reach the later ones, and nothing overlaps the content below.
- Tab labels get slightly tighter padding and text size on mobile so more of them are visible at once.
- On tablet and desktop the tab bar behaves as it does today.
- Content below the tabs keeps its existing spacing, now correctly clear of the bar.

## Technical notes

- Single file: `src/pages/ReviewDetailPage.tsx`.
- Replace `TabsList` classes `flex w-full flex-wrap justify-start` with a non-wrapping, `overflow-x-auto`, `h-auto` variant (e.g. `w-full justify-start overflow-x-auto whitespace-nowrap`), and add `shrink-0 text-xs sm:text-sm` on each `TabsTrigger`.
- Presentation only — no changes to review logic, services or stages.
