

# Remove +44 Validation for Payment Collection Phone

## Overview

Remove the strict `+44` format validation from the payment collection phone number field, allowing any valid phone number format.

## Current Behavior

The `paymentCollectionPhone` field currently requires:
- Exactly `+44` prefix
- Followed by exactly 10 digits
- Error message: "Must be +44 followed by 10 digits"

## Changes Required

### File: `src/pages/CreateOrder.tsx`

**Change 1**: Update the `paymentCollectionPhone` validation (line 76)

Replace the strict `phoneValidation` with a simple string validation that only requires the field to not be empty when payment on collection is enabled.

```typescript
// Before (line 76)
paymentCollectionPhone: phoneValidation.optional().or(z.literal("")),

// After
paymentCollectionPhone: z.string().optional(),
```

**Change 2**: Update the `superRefine` validation (lines 97-105)

The existing check ensures a phone is provided when needed - keep this but remove any format validation:

```typescript
// Keep existing check (lines 97-105)
if (data.needsPaymentOnCollection && !data.paymentCollectionPhone?.trim()) {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Payment collection phone is required",
    path: ["paymentCollectionPhone"],
  });
}
```

### File: `src/components/create-order/OrderOptions.tsx`

**Change 3**: Update the placeholder text (line 139)

```typescript
// Before
<Input placeholder="+44XXXXXXXXXX" {...field} />

// After
<Input placeholder="Enter phone number" {...field} />
```

## Summary of Changes

| File | Line | Change |
|------|------|--------|
| `CreateOrder.tsx` | 76 | Replace `phoneValidation.optional().or(z.literal(""))` with `z.string().optional()` |
| `OrderOptions.tsx` | 139 | Change placeholder from `"+44XXXXXXXXXX"` to `"Enter phone number"` |

## Result

- Payment collection phone will accept any format (e.g., `07123456789`, `+44 7123 456789`, `0044 7123456789`)
- Validation only requires the field to be non-empty when "Payment Required on Collection" is enabled
- Sender and receiver phone fields remain unchanged with the `+44` validation

