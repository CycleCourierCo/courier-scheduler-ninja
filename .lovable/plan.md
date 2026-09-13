# Charge a different rate for "big bikes" on special-rate accounts

Today, an account with a special rate (like mynextbikebusiness@gmail.com) gets that one rate applied to every bike on the invoice. This adds a second agreed rate for bigger bikes, plus a tick box on the individual job so your team decides when it applies.

## What you'll be able to do

- On the account's settings (where the special rate is set today), set a **second rate for big bikes** alongside the existing one. Optional — leave it blank for accounts that don't need it.
- On any job, tick **Charge big-bike rate**. Only visible/usable for staff.
- When the invoice is generated (weekly batch or manually), each job uses:
  - big-bike rate, if the job is ticked and the account has one set;
  - otherwise the account's normal special rate;
  - otherwise the standard price for that bike type.
- If a job is ticked but the account has no big-bike rate set, the job is reported as a problem in the invoice run summary instead of being quietly charged the wrong amount.
- Northern Ireland ferry surcharge and inspection/boxing/guaranteed-delivery lines keep working exactly as now.

Works for any special-rate customer, not just this one.

## Technical notes

- Migration:
  - `profiles.large_bike_rate_code text` (nullable) — mirrors `special_rate_code`; also add it to the `p_updates` handling in the `admin_update_user_profile`-style function so the edit dialog can save it.
  - `orders.use_large_bike_rate boolean not null default false`.
- QuickBooks product naming follows the existing convention: `Collection and Delivery within England and Wales - Special Rate - {code}`, so the big-bike rate is just a second code resolving to its own product. No pricing hardcoded in code.
- `supabase/functions/create-quickbooks-invoice/index.ts`: fetch `large_bike_rate_code` alongside `special_rate_code`, resolve its product once per run, and choose per order — `use_large_bike_rate && largeRateProduct` → large product, else existing special-rate product, else bike-type lookup. Ticked-but-unconfigured orders are pushed into the existing skipped/reported list.
- UI: add the field to `src/components/user-management/EditUserDialog.tsx` and `special_rate_code`'s neighbours in `src/types/user.ts`; add the per-order toggle to the order detail admin controls, admin/sales only, writing `use_large_bike_rate`.
- Order mapping: add `useLargeBikeRate` to `src/types/order.ts` and `src/services/orderServiceUtils.ts`.
- No RLS changes — both columns sit on tables with existing admin-write policies.
