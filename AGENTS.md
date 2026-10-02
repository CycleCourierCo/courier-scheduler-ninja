# Project architecture

- Public inspection decisions go through the `public-inspection-approval` Edge Function; privileged database approval helpers remain service-role-only to prevent direct browser execution.
- Warehouse bike-storage anniversaries are calculated in Europe/London and billed through the weekly QuickBooks invoice path with a service-role-only bike-month ledger, so missed months can be caught up without duplicate charges.
- Unboxed-bike preparation emails are sent from the order-creation background workflow to the collection contact and use an atomic order timestamp claim to prevent duplicates.