

## Smart Phone Validation Error Messages

### What Changes

**`src/pages/CreateOrder.tsx`** — Replace the single generic `refine` message with multiple specific checks:

```tsx
const phoneValidation = z
  .string()
  .min(1, "Phone number is required")
  .refine((val) => val.startsWith('+44'), {
    message: "Phone number must start with +44",
  })
  .refine((val) => {
    if (!val.startsWith('+44')) return true; // skip if prefix already failed
    const digits = val.substring(3);
    if (digits.startsWith('0')) return false;
    return true;
  }, {
    message: "Remove the leading 0 after +44 (e.g. +447123456789, not +440712...)",
  })
  .refine((val) => {
    if (!val.startsWith('+44')) return true;
    const digits = val.substring(3).replace(/\D/g, '');
    if (digits.length > 10) return false;
    return true;
  }, {
    message: "Phone number is too long — must be +44 followed by exactly 10 digits",
  })
  .refine((val) => {
    if (!val.startsWith('+44')) return true;
    const digits = val.substring(3).replace(/\D/g, '');
    if (digits.length < 10) return false;
    return true;
  }, {
    message: "Phone number is too short — must be +44 followed by exactly 10 digits",
  });
```

This gives users specific, actionable feedback instead of the generic "Must be +44 followed by 10 digits".

### Files Modified
- `src/pages/CreateOrder.tsx` — replace `phoneValidation` with chained contextual refines

