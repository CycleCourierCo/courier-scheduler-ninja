

## Fix: Add Padding to Return Button

The "Return to Sender" button text is wrapping but looks cramped without enough internal padding.

**File: `src/pages/CustomerOrderDetail.tsx`** (~line 233)

Add vertical padding (`py-3`) to the button so the wrapped text has breathing room:

```tsx
className="flex-1 sm:flex-none whitespace-normal text-left py-3"
```

This gives the multi-line button text proper spacing on mobile.

