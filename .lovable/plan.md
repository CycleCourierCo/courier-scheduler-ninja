

## Fix: Shorten Return Button Text on Mobile

The button text "Return this bike to sender" is too long and gets cut off on the 360px mobile viewport (screenshot shows "eturn this bike to").

**File: `src/pages/CustomerOrderDetail.tsx`** (~line 236)

Use responsive text — short label on mobile, full label on larger screens:

```tsx
<RotateCcw className={`h-4 w-4 mr-2 ${creatingReturn ? 'animate-spin' : ''}`} />
{creatingReturn ? "Creating..." : (
  <>
    <span className="sm:hidden">Return to Sender</span>
    <span className="hidden sm:inline">Return this bike to sender</span>
  </>
)}
```

This keeps the full descriptive text on desktop while fitting nicely on mobile.

