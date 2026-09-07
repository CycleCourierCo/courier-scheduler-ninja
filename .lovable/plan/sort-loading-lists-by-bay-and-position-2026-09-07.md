# Sort loading lists by bay and position

Right now the bikes in the loading messages come out in whatever order the data arrives, so a list can read A3, B6, A9, B7, A7. Every list should read in bay-then-number order: A3, A7, A9, B6, B7.

## What changes

In the loading list that goes out by WhatsApp and email:

- **Bay breakdown (management/loader message)**: bays listed alphabetically (A, B, C, D, then any further bay labels), bikes inside each bay ordered by their number. Bays beyond the four current ones are handled properly instead of falling into a random order.
- **Each driver's own list**: the "bikes to collect from depot" section is ordered by bay and number rather than arbitrary order. Bikes without a bay (still with a driver or awaiting collection) sit after the bay bikes, ordered by customer name.
- **Management list per driver**: the per-driver blocks of bikes leaving the depot use the same bay-and-number order; the bikes coming into the depot are ordered by customer name.
- **Multi-bay bikes**: when one bike sits in more than one spot, the spots it shows (for example "Bay A3, Bay A9") are also listed in order.

The numbering shown next to each bike (1., 2., 3.) stays sequential, so it will now count down the list in the new order.

## Technical notes

- Add a shared comparator in `supabase/functions/send-loading-list-whatsapp/index.ts`, e.g. `compareByBayPosition(a, b)`: take each bike's lowest allocation (bay label uppercased, compared with `localeCompare`; position compared numerically), push bikes with no allocation last, tie-break on `receiver.name`.
- Apply it to: `categories.bikesToCollect` (text builder `buildDriverMessage` and `buildDriverEmailHtml`), the `fromDepotByDriver` groups in `buildManagementEmailHtml`, and the row list in `buildBayBreakdown`.
- In `buildBayBreakdown`, replace the hardcoded `['A','B','C','D']` index sort with a natural sort of the bay keys (known bays first, then remaining labels alphabetically) and keep `position` numeric sort within each bay.
- Sort `bike.storageAllocations` before joining into the location string in `formatBikeEntry` and the three HTML builders (lines ~137, ~251, ~412, ~738).
- No schema or frontend data changes; `src/pages/LoadingUnloadingPage.tsx` already orders on-screen bay groups by configured bay order and position.
