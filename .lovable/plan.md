# Fix routes overlapping + guaranteed job check

## 1. KU17DDH and DF66UZB heading the same way
The area split gives each van its own slice of the map, but the slices are only applied when choosing which jobs a van gets — the optimiser can still pull nearby jobs across, and the "core ring" round the depot (about 15 miles) lets any van take jobs there. So two vans can still go out the same way.

Fix:
- Make the slice a hard rule: a van can only be given jobs inside its own slice (plus the core ring right by the depot).
- Shrink the core ring to about 8 miles so it can't take in a whole direction.
- After planning, if two routes' main direction is within one slice of each other, merge or re-split them and plan again once.
- Each route card warns "Overlaps with {van}" if this still happens, so it's never silent.

## 2. CCC754296471539KATYO4 (Poole BH12 to YO43, guaranteed Tuesday)
Checked: the bike hasn't been collected yet, and its **collection** is on Monday's routes (AV66UTH / KW65ULZ / LK67PRZ in different runs). The delivery can only go on Tuesday's plan, after the bike is collected Monday — that's why it isn't a Monday delivery. No bug there, but:
- Route cards will show a "Guaranteed {date}" badge on the collection stop, so you can see it's been planned for the guarantee.
- If you generate Tuesday, the delivery gets top priority.

## Technical
- route-optimize: enforce sector assignment as VROOM job skills per van; core radius 8 mi; post-solve overlap check on route bearing, one re-solve; `overlap_with` on route debug.
- GenerateRoutesDialog: overlap warning + guaranteed badge on collection stops.
