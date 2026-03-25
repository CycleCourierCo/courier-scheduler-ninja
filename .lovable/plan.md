

## Wrap "Return to Sender" Button Text

**File: `src/pages/CustomerOrderDetail.tsx`** (lines 233, 238)

Change the mobile label back to "Return to Sender" and allow the button text to wrap onto two lines so "Return to" appears on line 1 and "Sender" on line 2:

- Line 233: Change `className="flex-1 sm:flex-none"` to `className="flex-1 sm:flex-none whitespace-normal text-left"`
- Line 238: Change `<span className="sm:hidden">Return</span>` to `<span className="sm:hidden">Return to Sender</span>`

This lets the button text naturally wrap on narrow screens instead of being truncated.

