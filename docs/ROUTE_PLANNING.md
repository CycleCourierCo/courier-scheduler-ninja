# Route planning — how Generate Routes works

Generate Routes builds van routes for the days you pick. The idea is deliberately simple:

- **Our system decides** which day is being planned, which jobs may go that day, and how many vans are out.
- **The optimiser (VROOM, via Verso) decides** which van takes which job and in what order.

Everything runs in the `route-optimize` edge function. Verso credentials stay on the server.

## What you set before a run

| Setting | Default | What it does |
| --- | --- | --- |
| Days to plan | next 5 working days | Each day is planned in turn, earliest first |
| Firm days | 2 | The first days get the full fine-tuning; later days may be rougher |
| Start time | 09:00 | Vans leave the depot at this time |
| Inspection lead days | never | How long after collection an inspection job may be delivered; blank means only hand-finished inspections unlock |
| Long day allowed | 1 | Whether one van may run a 15-hour day for a difficult area |
| Jobs per route (target) | 13 | Vans come off the road until routes reach this |
| Fewest jobs allowed | 9 | Below this a route is flagged for a dispatcher |
| Include expired jobs | off | Lets jobs whose customer dates have lapsed be planned anyway |
| Van grid | all working vans | Tick which vans are out on which day |

Vans only appear if they are in use or off road. Repair, awaiting sale, sold and written-off vans are never planned.

## Which jobs can go on a day

A collection can go if it hasn't been collected or already booked. A delivery can go if the bike is in the depot, or its collection is planned earlier in this run or on an already-locked day, with at least a day in between — longer if it needs an inspection and you've set lead days.

Left out entirely: Northern Ireland and ferry work, jobs on hold, Box My Bike deliveries, anything without a map position, and any job already locked or booked in.

Collection and delivery are always two separate jobs for the optimiser — never tied to the same van.

## What "must go today" means

There are only two levels of urgency:

- **Must go today** — a guaranteed date falling on this day, the customer's last available date, or an expired job when you've switched the override on.
- **Everything else** — planned if it fits, otherwise carried to a later day.

Must-go jobs are never given up to make a route tidier. If one can't be planned it appears in **At-risk jobs** with the reason.

## Difficult areas and the long day

Cornwall/Devon, East Kent, Carlisle & the Lakes, Northumberland and Pembrokeshire are marked as difficult areas. On any day at most one van may run 15 hours to cover one of them. The area chosen is the one with the most must-go work, then the most work overall, and only if it has at least 5 jobs or one must-go job. Difficult work in the other areas waits for another day. All other vans run a 13-hour day, depot to depot.

## Filling the vans

Each day is solved once with every ticked van. Then, up to six times, the emptiest route below the target is taken off the road and the day re-solved — unless doing so would drop a must-go job, in which case that van is kept and the reason is recorded.

Afterwards the day is checked once more with one extra van over the leftover jobs. If that extra van would carry a full day's work or any must-go job, the day says so.

Routes wider than 150 miles across get a warning badge only; nothing is thrown off a route to make it look tidier.

## Money

Each stop is worth half the order's charged price, excluding VAT — the customer's special rate if they have one, otherwise the standard price for the bike type. Cost is driver hours at £11 plus 45p a mile. The optimiser itself is told £11 an hour and 45p a mile so it keeps mileage down; if it ever refuses those figures the run stops with an error rather than quietly producing sprawling routes.

## Time limits

A run has 90 seconds. Firm days get the full treatment; later days may get a single pass, and anything that had to be cut short is listed at the top of the results as "plan incomplete".

## Using a plan

**Lock day** reserves that day's jobs so a later run won't touch them. **Use this route** locks the route and opens Get Timeslots in a new tab with the stops in order — Get Timeslots remains the source of truth for customer times. **Try one fewer van** / **Try one more van** re-runs the plan with that day's van count changed.

## Panels

- **At-risk jobs** — must-go work that couldn't be planned, worst first.
- **Needs dates** — jobs with no dates, expired dates or a missed guarantee, with buttons to ask the customer for new dates.
- **Run details** (admins) — jobs per route, solver calls, vans taken off the road and why, margins.
