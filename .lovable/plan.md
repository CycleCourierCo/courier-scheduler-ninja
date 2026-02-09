

# Add Special Rate Code to User Profiles for Invoice Pricing

## Overview

This feature adds a `special_rate_code` field to user profiles. When a B2B customer has a special rate code set, **all bikes** in their invoices will use a single QuickBooks product named:

```
Collection and Delivery within England and Wales - Special Rate - {special_rate_code}
```

This overrides the normal per-bike-type pricing (e.g., "Electric Bike - Under 25kg", "Cargo Bikes") for that customer.

## Implementation Components

### 1. Database Migration

Add a new nullable text column to the `profiles` table:

```sql
ALTER TABLE public.profiles
ADD COLUMN special_rate_code text;
```

### 2. TypeScript Type Update

Update `src/types/user.ts` to include the new field:

```typescript
export interface UserProfile {
  // ... existing fields ...
  special_rate_code: string | null;
}
```

### 3. Edit User Dialog Update

Update `src/components/user-management/EditUserDialog.tsx` to:
- Add the field to the Business tab (since this applies to B2B customers)
- Include it in the form state initialization
- Add an input field with a clear label and helper text

### 4. QuickBooks Invoice Logic Update

Modify `supabase/functions/create-quickbooks-invoice/index.ts` to:

1. **Fetch the customer's profile** to check for `special_rate_code`
2. **If special rate code exists:**
   - Look up the special rate product: `Collection and Delivery within England and Wales - Special Rate - {code}`
   - Use that product for ALL bikes in the invoice (ignoring individual bike types)
3. **If no special rate code:**
   - Continue using the existing per-bike-type pricing logic

## Detailed Changes

### Database Migration

```sql
-- Add special rate code to profiles
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN special_rate_code text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.special_rate_code IS 
  'If set, overrides all bike-type pricing with a single Special Rate product in QuickBooks';
```

### Frontend Changes

**EditUserDialog.tsx - Business Tab Addition:**

```tsx
// In the Business tab section (shown only for business customers)
<div className="space-y-2 col-span-2">
  <Label htmlFor="edit-special-rate-code">Special Rate Code</Label>
  <Input
    id="edit-special-rate-code"
    placeholder="e.g., CONTRACT-001"
    value={formData.special_rate_code || ''}
    onChange={(e) => setFormData({ ...formData, special_rate_code: e.target.value })}
  />
  <p className="text-xs text-muted-foreground">
    If set, all bikes will be invoiced using: "Collection and Delivery within England and Wales - Special Rate - {'{code}'}"
  </p>
</div>
```

### Edge Function Logic Change

The key change in `create-quickbooks-invoice/index.ts`:

```typescript
// After getting customer ID and before building line items:

// Fetch customer profile to check for special rate code
const { data: customerProfile } = await supabase
  .from('profiles')
  .select('special_rate_code')
  .eq('id', invoiceData.customerId)
  .single();

const specialRateCode = customerProfile?.special_rate_code;
let specialRateProduct: ProductInfo | null = null;

if (specialRateCode) {
  console.log(`Customer has special rate code: ${specialRateCode}`);
  specialRateProduct = await findProductByBikeType(
    tokenData.access_token, 
    tokenData.company_id, 
    `Special Rate - ${specialRateCode}`
  );
  
  if (!specialRateProduct) {
    throw new Error(
      `Special rate product not found in QuickBooks: ` +
      `"Collection and Delivery within England and Wales - Special Rate - ${specialRateCode}"`
    );
  }
}

// Then in the line item creation loop:
for (const bike of bikesToProcess) {
  // If special rate, use that product for all bikes
  const product = specialRateProduct || 
    await findProductByBikeType(tokenData.access_token, tokenData.company_id, normalizedType);
  
  // ... rest of line item creation
}
```

## Flow Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                    Create Invoice Request                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Fetch Customer Profile from Database               │
│                   (check special_rate_code)                  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│  special_rate_code NULL  │    │   special_rate_code SET      │
│                          │    │   (e.g., "CONTRACT-001")     │
└──────────────────────────┘    └──────────────────────────────┘
              │                               │
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│  Use per-bike-type       │    │  Look up single product:     │
│  pricing (existing)      │    │  "...Special Rate -          │
│                          │    │   CONTRACT-001"              │
│  - Electric Bike         │    └──────────────────────────────┘
│  - Non-Electric Bikes    │                  │
│  - Cargo Bikes           │                  ▼
│  - etc.                  │    ┌──────────────────────────────┐
└──────────────────────────┘    │  Apply this product to ALL   │
              │                 │  bikes in the invoice        │
              ▼                 └──────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Create Invoice Line Items                  │
└─────────────────────────────────────────────────────────────┘
```

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migration.sql` (new) | Add `special_rate_code` column to profiles |
| `src/types/user.ts` | Add `special_rate_code` field to `UserProfile` interface |
| `src/components/user-management/EditUserDialog.tsx` | Add input field in Business tab |
| `supabase/functions/create-quickbooks-invoice/index.ts` | Add special rate logic before line item creation |

## QuickBooks Setup Required

For this to work, the admin must create products in QuickBooks with names matching the pattern:

```
Collection and Delivery within England and Wales - Special Rate - {code}
```

Examples:
- `Collection and Delivery within England and Wales - Special Rate - CONTRACT-001`
- `Collection and Delivery within England and Wales - Special Rate - PREMIUM`
- `Collection and Delivery within England and Wales - Special Rate - FLEET-DISCOUNT`

## Error Handling

If a customer has a special rate code but the corresponding QuickBooks product doesn't exist, the invoice creation will **fail immediately** with a clear error message indicating which product needs to be created.

## Testing Checklist

| Test | Expected Result |
|------|-----------------|
| Customer without special rate code | Uses per-bike-type pricing (existing behavior) |
| Customer with special rate code, product exists | All bikes use special rate product |
| Customer with special rate code, product missing | Error: "Special rate product not found" |
| Edit dialog shows field for B2B customers | Field visible in Business tab |
| Edit dialog hides field for non-B2B users | Field not visible |
| Empty special rate code | Same as null (use per-bike-type pricing) |

