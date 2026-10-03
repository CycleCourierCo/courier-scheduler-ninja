# Show expired / last-date jobs per route, and explain any that were missed

## What you'll see
- Each route card in Generate Routes gets a badge: "3 expired, 1 last date today".
- Expanding the card lists those jobs (tracking number, collection/delivery, last date), red for expired, amber for last date on the route day.
- A "Must-go jobs not planned" panel under the results lists every expired or last-date job that didn't make it, with the reason (not collected yet, not inspected, collection is on the same day, Northern Ireland, no van could fit it).

## First step: check the 6 jobs that look missed
In this morning's run (08:22) these may be missing for no good reason: PASPE8, EBICA2, CLILL6 (last date Sunday, collected), SCOTA2, CHRSA7 (expired, collected), ALASW2 (expired collection). I'll find why each was left out. If the reason is a bug, I'll fix it. If the reason is valid (for example the bike isn't inspected), it'll show in the new panel.

## Technical details
- route-optimize: tag each placed stop with `must_go: 'expired' | 'last_date'` and `last_date`; return `must_go_missed[]` with a reason code taken from the eligibility filters and the solver's unassigned list. Store both in the plan debug data.
- GenerateRoutesDialog: show the badge and the list on each route card from the stop tags, plus the missed panel.
- No change to how jobs are prioritised.
