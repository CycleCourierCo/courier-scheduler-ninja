

## Fix: Bike value not validated on "Next" button in Create Order

### Problem
The `isDetailsValid` memo (line 250-252) checks that each bike has `brand`, `model`, and `type` but omits `value`. Since `value` is required by the Zod schema (`z.string().min(1, "Bike value is required")`), the form won't submit without it, but the "Next" button doesn't catch it — so the user gets no toast error.

### Fix

**`src/pages/CreateOrder.tsx`** — line 251-252, add `bike.value` to the validation check:

```typescript
bikes.every(bike => bike && bike.brand && bike.model && bike.type && bike.value &&
                          bike.brand.trim() !== '' && bike.model.trim() !== '' && bike.type.trim() !== '' && bike.value.trim() !== '');
```

One line change. The toast error message ("Please complete all required fields in Bike Details.") already covers this case.

