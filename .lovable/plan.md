

## Fix: Make "Return to Sender" Button Fully Visible

The button text is clipped because `size="sm"` constrains height. Need to remove the small size constraint and ensure adequate padding.

**File: `src/pages/CustomerOrderDetail.tsx`** (line 230, 233)

- Remove `size="sm"` so the button uses default sizing
- Update className to `"flex-1 sm:flex-none whitespace-normal text-left py-3 px-4 min-h-[48px]"`

This gives the button enough room for wrapped text to be fully visible on mobile.

