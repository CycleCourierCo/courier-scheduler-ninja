# Put the collection badge next to the customer availability badge

On the Get Timeslots popup, a delivery stop currently shows its collection badge ("Not Collected", "Collected", "Collected earlier", "Collection after delivery!") several badges further along the row, after the job-age and availability-dates-left badges. Moving it to sit immediately after the availability badge puts the two things you check together — is the customer available, and is the bike actually collected.

## Changes

Badge order on each stop becomes:

```text
before:  Delivery · bikes · Customer Available · Booked 4 days ago · 2 dates left · Not Collected · ferry · inspection · hours
after:   Delivery · bikes · Customer Available · Not Collected · Booked 4 days ago · 2 dates left · ferry · inspection · hours
```

- Applies to both layouts of the popup: single stops and grouped "Multiple stops" rows.
- Applies to every collection badge text, not just "Not Collected" — so "Collected", "Collecting on Route", "Collected earlier (Wed 2 Sep)" and the warnings all move with it.
- Nothing else changes: same badge wording, colours, icons and tooltips; no change to what gets sent to customers, Shipday or invoices.

## Technical notes

- Single file: `src/components/scheduling/RouteBuilder.tsx`.
- Grouped stops: move the `collectionBadge && (...)` block (currently lines 845-850) up to directly after the availability badge block (ends line 819).
- Single stops: move the `job.type === 'delivery' && (() => getCollectionStatusBadge(...))()` block (currently lines 982-999) up to directly after the availability badge block (ends line 953).
- The badge values are already computed at those points, so this is a pure JSX reorder — no logic, database or edge function changes.
