# Fix routes overlapping + guaranteed job check

## 1. KU17DDH and DF66UZB heading the same way
The area split gives each van its own slice of the map, but the slices are only applied when choosing which jobs a van gets — the optimiser can still pull nearby jobs across, and the "core ring" round the depot (about 15 miles) lets any van take jobs there. So two vans can still go out the same way.

Fix:
- Make the slice a hard rule: a van can only be given jobs inside its own slice (plus the core ring right by the depot).
- Shrink the core ring to about 8 miles so it can't take in a whole direction.
- After planning, if two routes' main direction is within one slice of each other, merge or re-split them and plan again once.
- Each route card warns "Overlaps with {van}" if this still happens, so it's never silent.

## 2. CCC754296471539KATYO4 (Poole BH12 to YO43, guaranteed Tuesday)
Not collected yet, and Monday is the last day it can be collected for a Tuesday delivery. The planner dropped it with "no van could fit it" — Poole is far south and the slice rules plus the normal route-hour limit left no van able to reach it. A guaranteed job on its last possible collection day should never be dropped like that.

Fix:
- On the last valid collection day, a guaranteed collection becomes a must-place job: it's allowed into any van's slice and that van may run up to the long-day limit to fit it.
- The planner picks the van that adds the least extra time (e.g. the south/south-west van).
- If it still truly can't fit, At-risk says why (e.g. "needs X extra hours") instead of a generic message.
- Route cards show a "Guaranteed {date}" badge on that stop.

## Technical
- route-optimize: enforce sector assignment as VROOM job skills per van; core radius 8 mi; post-solve overlap check on route bearing, one re-solve; `overlap_with` on route debug.
- Guaranteed last-day collections: no sector skill, priority 100, long-day time window on the cheapest-insertion van; specific at-risk reason with extra time needed.
- GenerateRoutesDialog: overlap warning + guaranteed badge on collection stops.
