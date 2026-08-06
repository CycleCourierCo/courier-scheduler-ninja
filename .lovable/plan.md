# Fix layout widening after picking an address-book contact

Selecting a contact on the Create Order page makes the whole form grow wider than the screen, so content slides sideways and overlaps (reported on a standard phone, ~360px wide, as in the attached screenshot).


## Cause

The address-book selector's button shows the chosen contact as `Name (email@domain)` on a single line. The row holding that text has no minimum-width reset, and the email sits inside the truncating element rather than being allowed to shrink. A long name plus email therefore sets a minimum width for the button, which is `w-full`, so it pushes its card — and the whole page — wider than the viewport.

## Fix

In the contact selector (`src/components/create-order/ContactSelector.tsx`):

- Let the text row shrink instead of dictating width (min-width reset on the flex row and on the trigger button itself).
- Truncate the name and email properly, with the email on its own line on narrow screens so nothing forces horizontal growth.
- Keep the chevron pinned and non-shrinking.

No behaviour changes: same contacts, same selection, same fill-in of the form. Presentation only.

Because the same selector is reused in the admin contact editor on order detail, that screen gets the same fix for free.

## Verify

Run the app at Z Fold cover width (344px) and standard phone width (360px), select a long-named contact with a long email in both Collection and Delivery steps, and confirm document width still equals viewport width with no sideways shift.
