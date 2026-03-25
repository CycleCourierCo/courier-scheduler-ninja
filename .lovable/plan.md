

## Reorder Action Buttons

**File: `src/pages/CustomerOrderDetail.tsx`** (lines 227-254)

Reorder the three items in the action row from: `Return → Print Label → Status` to: `Status → Print Label → Return`.

```tsx
<div className="flex items-center gap-2 flex-wrap">
  <div className="flex-1 sm:flex-none">
    <StatusBadge status={order.status} />
  </div>
  <Button variant="secondary" size="sm" ...>
    Print Label
  </Button>
  <Button variant="default" ...>
    Return to Sender
  </Button>
</div>
```

Single change, no logic affected.

