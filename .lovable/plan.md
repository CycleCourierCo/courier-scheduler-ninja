# Lock down QuickBooks driver bill creation

The function that creates a driver payment bill in QuickBooks currently accepts requests from anyone who knows its address, and it trusts whatever pay figures the caller sends. Two fixes: require staff sign-in, and calculate the bill from our own database instead of the caller's numbers.

## What changes

1. **Require authorisation.** Only signed-in admins can trigger a bill, plus our own internal server-to-server calls. Everyone else gets rejected.
2. **Stop trusting the submitted amounts.** The request only needs to say which timeslip to bill. The function looks the timeslip and driver up itself and builds the bill from the stored, approved values, so nobody can invent a driver email or a pay total.
3. **Only approved timeslips.** If the timeslip isn't approved, the request is refused.
4. **Keep existing flows working.** The two places that create bills today (approving a timeslip, and the manual "create bill" action) are both admin-only screens, so they keep working. There is no scheduled/cron job that creates driver bills, so nothing scheduled breaks. Other QuickBooks automation (weekly customer invoicing) is a separate function and is untouched.

## Technical details

- `supabase/functions/create-quickbooks-bill/index.ts`:
  - Call the shared `requireOpsAuth(req, ['admin'])` gate from `_shared/auth.ts` (already accepts the service role key for internal calls) right after the CORS preflight; return its 401/403 with CORS headers.
  - Validate the body with a minimal schema: `timeslipId` (uuid) required; ignore/deprecate client-supplied `driverName`, `driverEmail`, `date`, `totalPay`, `breakdown`.
  - Using the service-role client already created in the function, fetch `timeslips` joined to `profiles` for the driver, assert `status === 'approved'`, and derive driver name/email, date, total pay and the hours breakdown from those rows.
  - Keep the existing QbSQL escaping of the driver email.
- `src/services/timeslipService.ts`: both `approveTimeslip` and `createQuickBooksBill` send only `{ timeslipId }`. Approval keeps its non-blocking try/catch.
- `supabase/config.toml`: leave `verify_jwt = false` (auth is validated in code so the service-role internal path still works).
- Mark the `qb_bill_no_auth` finding fixed after deploy.
