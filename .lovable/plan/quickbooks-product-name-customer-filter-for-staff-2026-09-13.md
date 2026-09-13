# QuickBooks product name + customer filter for staff

## 1. What to call the product in QuickBooks

Create it with exactly this name, using the same code you typed into the account's **Big Bike Rate Code** box:

```text
Collection and Delivery within England and Wales - Special Rate - {code}
```

So if the big-bike code is `MNB-BIG`, the product is:

```text
Collection and Delivery within England and Wales - Special Rate - MNB-BIG
```

Set its price to the agreed big-bike price. It is the same naming rule already used for the normal special rate, so the two products sit side by side. If the product is missing, that customer's invoice run stops with a message naming the exact product to create rather than charging the wrong price.

## 2. Why jnh096506@gmail.com can't filter by customer

That account's main role is **route planner**, and the "All Customers" dropdown on the dashboard is currently shown to admins only. The account can already see every job (route planners are not restricted to their own orders), so the dropdown is the only thing missing — nothing to do with data access.

### Fix

Show the customer dropdown, and honour the chosen customer when loading jobs, for internal staff roles rather than admin alone: admin, route planner, sales, customer service, project manager, timeslip admin, loader, mechanic — matching whoever already sees other people's jobs.

Behaviour stays unchanged for B2B customers: they never see the dropdown and still only see their own jobs.

## Technical notes

- `src/components/OrderFilters.tsx`: replace the two `userRole === "admin"` checks (the `b2b-customers` query gate/`enabled`, and the Select's render guard) with a shared `canFilterByCustomer` helper covering internal roles.
- `src/services/orderService.ts` (~line 173): change `if (userRole === "admin" && customerId)` to apply whenever the role is an internal staff role, so the filter actually narrows results for route planners.
- Keep the existing `userRole !== "admin" && userRole !== "route_planner"` own-orders restriction untouched for now; roles that are still scoped to their own orders will simply see a dropdown listing only themselves — so gate the dropdown to roles that already see all jobs (admin, route_planner) plus any other role we confirm is unrestricted.
- No database, RLS, or grant changes; the customer list already reads approved `b2b_customer` profiles under existing policies.
