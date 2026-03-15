

## Fix: B2B Profile Opening Hours Save Error

### Problem
The custom `handleSubmit` function (line 121-135) checks `form.formState.isValid` **before** calling `form.handleSubmit(onSubmit)`. With react-hook-form's `mode: "onSubmit"`, `isValid` remains `false` until after validation runs via `handleSubmit`. This means the premature check at line 128 always evaluates `!isValid` as `true`, showing a spurious error toast and blocking submission.

### Fix

**`src/pages/UserProfile.tsx`** — Replace the custom `handleSubmit` with a standard react-hook-form pattern:

- Remove the manual `handleSubmit` wrapper (lines 121-135)
- Use `form.handleSubmit(onSubmit)` directly in the form's `onSubmit`
- Add an `onError` callback to show the validation error toast

```tsx
// In the form element:
<form onSubmit={form.handleSubmit(onSubmit, (errors) => {
  const errorCount = Object.keys(errors).length;
  toast.error(`Please fill in all required fields correctly (${errorCount} error${errorCount > 1 ? 's' : ''})`);
})} className="space-y-6">
```

This is a single-file change, ~5 lines modified.

