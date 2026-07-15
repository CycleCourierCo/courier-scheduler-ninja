# QuickBooks Customer Sync for B2B Accounts

## Goal
1. When a B2B account is approved, automatically create a matching Customer in QuickBooks.
2. In User Management → Business section, show a link to the QuickBooks customer if synced, otherwise show a "Create in QuickBooks" button.

## Changes

### 1. Database
Add a column to `profiles` to track QuickBooks linkage:
- `quickbooks_customer_id text` (nullable)

This lets us both know whether a customer exists in QB and build a link straight to their QB record.

### 2. New edge function: `create-quickbooks-customer`
Callable from the frontend (admin only) and from the approval flow.

Input: `{ userId: string }`

Logic:
- Load the profile (name, company_name, email, phone, accounts_email, address_line_1/2, city, postal_code, website).
- Load QuickBooks token (reuse the same pattern as `create-quickbooks-invoice`, with refresh if expired).
- Search QuickBooks: `SELECT * FROM Customer WHERE PrimaryEmailAddr = '<email>'` (escaped).
  - If found → save the `Id` on the profile and return `{ customerId, alreadyExisted: true }`.
- Otherwise POST to `/v3/company/{realmId}/customer` with:
  - `DisplayName` = company_name (fallback: name, fallback: email)
  - `CompanyName` = company_name
  - `GivenName` / `FamilyName` = split of `name`
  - `PrimaryEmailAddr.Address` = email
  - `PrimaryPhone.FreeFormNumber` = phone
  - `BillAddr` = { Line1: address_line_1, Line2: address_line_2, City: city, PostalCode: postal_code, Country: "United Kingdom" }
  - `WebAddr.URI` = website (if set)
- Persist the returned `Id` to `profiles.quickbooks_customer_id`.
- Return `{ customerId, alreadyExisted: false }`.

CORS + JWT auth (admin check via `has_role`). `verify_jwt = false` in `supabase/config.toml` with manual admin verification (matches the pattern of other admin QB functions).

### 3. Hook into approval flow
In `src/pages/AccountApprovals.tsx`, after `admin_update_account_status(... 'approved')` succeeds for a business account, invoke `create-quickbooks-customer`. Failure shows a toast but does not roll back the approval ("Account approved — QuickBooks sync failed, retry from User Management").

### 4. User Management UI (`EditUserDialog.tsx`, Business tab)
Add a new row at the top of the Business tab:
- If `formData.quickbooks_customer_id` is set → show a link:
  `View in QuickBooks` → `https://app.qbo.intuit.com/app/customerdetail?nameId=<id>` (opens in new tab).
- If not set → show a `Create customer in QuickBooks` button that invokes `create-quickbooks-customer` with the current user id, then refreshes `formData.quickbooks_customer_id` from the response and shows a success toast.

Button disabled while in-flight; disabled with tooltip "Missing email" if the profile has no email.

## Technical notes
- `UserProfile` type gets a new `quickbooks_customer_id: string | null` field.
- `getBusinessAccountsForAdmin` / user list queries already `select *`, so no service-layer changes needed beyond exposing the new field on the type.
- Reuse `escapeQuickBooksString` from the invoice function; extract to `_shared/quickbooks.ts` if convenient, otherwise duplicate the small helper.
- Only trigger auto-sync for `is_business = true` profiles.

## Out of scope
- Updating an existing QuickBooks customer when the profile changes later.
- Handling multiple QuickBooks environments (uses the same single token record the invoice functions already use).
