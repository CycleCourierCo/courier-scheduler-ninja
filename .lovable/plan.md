

## Plan: Use accounts_email for inspection invoice creation

### Problem
The `create-inspection-invoice` edge function uses the profile's `email` field to look up the QuickBooks customer and set the `BillEmail`. It should prioritize `accounts_email` from the profile, falling back to `email` if `accounts_email` is not set.

### Change

**`supabase/functions/create-inspection-invoice/index.ts`**

1. Line 148: Add `accounts_email` to the profile select query:
   ```
   .select('email, accounts_email, name, company_name')
   ```

2. Line 152: Update the validation to accept either email:
   ```
   const billingEmail = customerProfile.accounts_email || customerProfile.email;
   if (!billingEmail) throw new Error('Customer profile or email not found');
   ```

3. Lines 196, 212: Use `billingEmail` instead of `customerProfile.email` for the QuickBooks customer lookup and error message.

4. Line ~248 (BillEmail): Use `billingEmail` for the invoice's `BillEmail.Address`.

No database or frontend changes needed.

