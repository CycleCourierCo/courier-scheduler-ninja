

## Add Manual Price Override for Special Rate Accounts

### Problem
Accounts with a `special_rate_code` have custom pricing that differs from standard bike-type rates. Currently, the profitability calculations use standard pricing for everyone, making revenue figures inaccurate for B2B accounts with special deals.

### Solution
Add a `special_rate_price` numeric field to the `profiles` table. When calculating revenue in the profitability service, if an order's customer has a `special_rate_price` set, use that per-stop price instead of the standard bike-type lookup. The admin can manually input the agreed price per stop in the user management dialog.

### Changes

| File | Change |
|---|---|
| **Database migration** | Add `special_rate_price numeric` column to `profiles` (nullable, default null) |
| `src/types/user.ts` | Add `special_rate_price: number \| null` |
| `src/components/user-management/EditUserDialog.tsx` | Add an input field for "Special Rate Price (£ per delivery)" next to the existing special_rate_code field |
| `src/services/profitabilityService.ts` | In `getRevenueForTimeslip`, after finding driver orders, look up the order's `user_id` → profile → `special_rate_price`. If set, use `special_rate_price / 2` as revenue per stop instead of `getRevenuePerStopForBikeType`. Cache profile lookups to avoid repeated queries. |

### Technical detail

The revenue override applies per order based on the **order's customer** (not the driver). In `getRevenueForTimeslip`, after fetching matching orders, batch-fetch the distinct `user_id`s from those orders, check their profiles for `special_rate_price`, and apply it per-order. Orders from customers without a special rate continue using standard bike-type pricing.

