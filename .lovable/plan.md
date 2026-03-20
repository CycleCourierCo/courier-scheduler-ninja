

## Style Return and Print Label Buttons

Both buttons currently use `variant="outline"` (transparent/bordered). Change them to use filled variants for better visibility.

### Changes

| File | Change |
|---|---|
| `src/pages/CustomerOrderDetail.tsx` | Return button: change `variant="outline"` to `variant="default"`. Print Label button: change `variant="outline"` to `variant="secondary"`. |
| `src/pages/OrderDetail.tsx` | Same changes for both buttons. |

This gives the Return button the primary gradient fill and the Print Label button a secondary filled style, making them stand out from the outline-styled Back button.

