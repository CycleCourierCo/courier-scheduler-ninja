

# Fix: Duplicate Variable Declaration in QuickBooks Invoice Function

## Problem Identified

The `create-quickbooks-invoice` edge function is **completely broken** and cannot start due to a syntax error:

```
SyntaxError: Identifier 'profileError' has already been declared
```

**Root Cause**: When I added the special rate code feature, I declared `profileError` twice:
- Line 265: `const { data: profile, error: profileError }` (admin check)
- Line 371: `const { data: customerProfile, error: profileError }` (special rate check)

JavaScript/TypeScript doesn't allow re-declaring a `const` in the same scope.

## Fix Required

Rename the second variable from `profileError` to `customerProfileError`:

### Line 371-378 Change:

**Before:**
```typescript
const { data: customerProfile, error: profileError } = await supabase
  .from('profiles')
  .select('special_rate_code')
  .eq('id', invoiceData.customerId)
  .single();

if (profileError) {
  console.warn('Could not fetch customer profile for special rate check:', profileError.message);
}
```

**After:**
```typescript
const { data: customerProfile, error: customerProfileError } = await supabase
  .from('profiles')
  .select('special_rate_code')
  .eq('id', invoiceData.customerId)
  .single();

if (customerProfileError) {
  console.warn('Could not fetch customer profile for special rate check:', customerProfileError.message);
}
```

## Impact

- **Before fix**: Invoice creation completely fails - function won't even start
- **After fix**: Invoice creation will work, and special rate codes will be applied correctly
- **Email**: Will also work again once the function boots successfully

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/create-quickbooks-invoice/index.ts` | Rename `profileError` → `customerProfileError` on lines 371, 377, 378 |

## Post-Fix Testing

After deploying, you should:
1. Try creating an invoice for Matthew Coulthard again
2. Verify the invoice appears in QuickBooks
3. Confirm the confirmation email is received

