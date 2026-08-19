# Show "Dates Expired" badge on the timeslot view

When a job's customer availability dates have all passed (every chosen date is before today), the availability badge should clearly flag it instead of only showing "Not Customer Date".

## Behaviour

For each job in the Route Timeslots drawer and the multi-job timeslot dialog:

- If every availability date for that leg (pickup dates for collections, delivery dates for deliveries) is earlier than today: show a red badge `Dates Expired`.
- If one of the dates matches the selected route date: keep the green `Customer Available` badge (a match always wins, even on a past-dated route).
- No dates at all: keep the existing grey `No Dates Provided`.
- Otherwise: keep the amber `Not Customer Date`.

## Technical notes

- `getAvailabilityBadge` exists twice: as a module-level helper in `src/components/scheduling/RouteBuilder.tsx` (used by both grouped and single stop rows) and as a local function in `src/components/scheduling/MultiJobTimeslotDialog.tsx`. Add the same expired check to both so the badge is consistent in the drawer and in the Get Timeslots popup.
- Expiry test: compare `format(new Date(date), 'yyyy-MM-dd')` against today's `yyyy-MM-dd` (matching the existing `hasAllDatesExpired` logic already used by the "Expired availability dates" filter in `RouteBuilder`), and place the check after the match check.
- Colour: `bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300`, consistent with other warning badges in these components.
