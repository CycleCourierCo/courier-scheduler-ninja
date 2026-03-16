

## Fix: "Next" Button Clicks But Doesn't Navigate

### Root Cause

The `handleNextToSender` function (line 329-345) does:
```tsx
const result = await form.trigger(["bikeQuantity", "bikes", ...]);
if (result && isDetailsValid) { setActiveTab("sender"); }
```

The problem: `form.trigger()` with the zod resolver validates the **entire schema**, not just the specified fields. Since sender/receiver fields are empty at this point, the zod resolver **throws an unhandled ZodError** and `result` comes back as `false` — even though the bike details are perfectly valid.

This is a known limitation of `@hookform/resolvers/zod` — calling `trigger` with field names still runs the full schema validation internally, and throws for unrelated field errors.

### Fix

**`src/pages/CreateOrder.tsx`**

1. In `handleNextToSender`: Remove reliance on `form.trigger()` result. Just use the already-computed `isDetailsValid` memo which correctly checks only bike fields:
```tsx
const handleNextToSender = () => {
  if (isDetailsValid) {
    setActiveTab("sender");
  } else {
    toast.error("Please complete all required fields in Bike Details.");
  }
};
```

2. In `handleNextToReceiver`: Same approach — use `isSenderValid` instead of `form.trigger()` result:
```tsx
const handleNextToReceiver = () => {
  if (isSenderValid) {
    setActiveTab("receiver");
  } else {
    // Keep the existing specific error message logic but read from form.formState.errors directly
    ...
  }
};
```

3. This also fixes the **unhandled promise rejection** Sentry errors, since we no longer call `form.trigger()` which throws the ZodError.

### Files Modified
- `src/pages/CreateOrder.tsx` — remove `form.trigger()` calls from navigation handlers, rely on memo-computed validity flags

