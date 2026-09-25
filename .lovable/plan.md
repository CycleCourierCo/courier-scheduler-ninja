# Add Box My Bike and Foam My Bike to Mechanic Profitability

## What you'll see

- Each mechanic's figures on Mechanic Profitability now include **Box My Bike** and **Foam My Bike** jobs, each counted as **45 minutes** of earned work.
- New columns: Boxed, Foamed, and their earned hours, added into the mechanic's total earned hours, efficiency and utilisation.
- The day-by-day breakdown lists these jobs alongside inspections and repairs ("Box up CCC… – 45 min").

## Who gets the credit

A job counts on the day it was boxed / foamed. It's credited to, in order:
1. The person you pick for it (see below), or
2. The person the job's Box/Foam task was assigned to.

If neither exists, the job goes into a new **"Needs allocating"** box at the top of the page: a list of the jobs (tracking number, bike, date boxed/foamed) with a mechanic dropdown on each. Pick someone and it's saved and immediately counted towards them. You can also change a job's mechanic later from the breakdown.

## Technical notes

- Migration: add `box_boxed_by_id uuid` and `foam_foamed_by_id uuid` to `orders` (nullable, no default). Only admins can set them (existing admin order-update policy); no new tables.
- `mechanicHoursService.ts` / `mechanicProfitabilityService.ts`: fetch orders with `box_boxed_at` or `foam_foamed_at` in range (paginated). Resolve mechanic from the new column, else the assignee of the linked `tasks` row (`linked_order_id`, title starting "Box up"/"Foam up"). Add 45 standard minutes per job; return unallocated jobs separately.
- `MechanicHoursSection.tsx` / `MechanicProfitabilityPanel.tsx`: new columns, breakdown rows, and a "Needs allocating" card with a mechanic select that writes the new column then refetches.
- No changes to Box/Foam workflows, pricing or invoicing. Revenue isn't added for these jobs — only time.
