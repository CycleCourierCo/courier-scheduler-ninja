# Remove the QuickBooks driver bill feature

The driver bill creation feature isn't used, so removing it entirely also resolves the security finding about unauthenticated callers being able to create bills in QuickBooks.

## What gets removed

- The behind-the-scenes service that creates a driver payment bill in QuickBooks.
- The "Create QuickBooks Bill" button and the bill number/link badge on timeslip cards.
- Automatic bill creation when an admin approves a timeslip (approval itself is unchanged).
- The unused bill columns kept on timeslips (bill id, number, link, created date) stay in the database for now so nothing existing is lost; they simply aren't read or written. Say the word if you'd rather drop them too.

Weekly customer invoicing and all other QuickBooks features are untouched.

## Technical details

- Delete the `create-quickbooks-bill` edge function (via the delete edge function tool) and its `[functions.create-quickbooks-bill]` block in `supabase/config.toml`.
- `src/services/timeslipService.ts`: remove `createQuickBooksBill` and the bill-invoke block inside `approveTimeslip`.
- `src/pages/DriverTimeslips.tsx`: remove the `createBillMutation`, `handleCreateBill`, and the `onCreateBill` prop.
- `src/components/timeslips/TimeslipCard.tsx`: remove the `onCreateBill` prop, the bill badge/link block, and the create-bill button.
- `src/types/timeslip.ts`: drop the four `quickbooks_bill_*` fields.
- Mark the `qb_bill_no_auth` finding fixed, noting the function no longer exists.
