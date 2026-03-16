

## Fix: "Next: Collection Information" Button Not Working

### Root Cause

The `TabsTrigger` for "Collection Information" has `disabled={!isDetailsValid}`, and **Radix UI Tabs ignores programmatic value changes when the target tab trigger is disabled**. So even though `handleNextToSender` correctly validates and calls `setActiveTab("sender")`, the Radix `Tabs` component refuses to switch because the "sender" trigger is disabled.

This is a known Radix Tabs behavior — a controlled `value` change is still blocked if the corresponding `TabsTrigger` is disabled.

### Fix

**`src/pages/CreateOrder.tsx`**

Remove `disabled` from all `TabsTrigger` components. The navigation buttons already handle validation — the tab triggers in the sidebar don't need to independently block navigation. Instead, add visual styling to indicate completion state without using `disabled`:

1. Remove `disabled={!isDetailsValid}` from the "Collection Information" TabsTrigger (line 522)
2. Remove `disabled={!isSenderValid || !isDetailsValid}` from the "Delivery Information" TabsTrigger (line 530)
3. Instead, add conditional opacity/styling to visually indicate which steps are ready, while still allowing programmatic tab switches:
   - Uncompleted tabs get `opacity-50 cursor-not-allowed` classes
   - Add an `onClick` guard on the TabsTrigger that shows a toast if prerequisites aren't met, preventing manual clicks but allowing programmatic switches via `onValueChange`

Alternative simpler approach: Keep the `disabled` prop but temporarily remove it right before calling `setActiveTab` by using a state flag, or bypass Radix entirely by not using controlled tabs for programmatic switches.

**Simplest reliable fix**: Remove `disabled` from `TabsTrigger` components entirely. Instead, handle validation in `onValueChange`:

```tsx
const handleTabChange = (value: string) => {
  if (value === "sender" && !isDetailsValid) {
    toast.error("Please complete Bike Details first.");
    return;
  }
  if (value === "receiver" && (!isDetailsValid || !isSenderValid)) {
    toast.error("Please complete previous steps first.");
    return;
  }
  setActiveTab(value);
};
```

Then use `onValueChange={handleTabChange}` on the `Tabs` component. This way programmatic calls to `setActiveTab` bypass the guard (since they don't go through `onValueChange`), while manual tab clicks are still validated.

### Files Modified
- `src/pages/CreateOrder.tsx` — remove `disabled` from TabsTriggers, add validation to `onValueChange` handler

