# Booking form: fix wrong taps and the jump back to Collection

## What the customer's video shows
The customer is on a Samsung Fold in split screen (WhatsApp on one side, the booking form on the other). They tap "Number of bikes" and the list opens straight under their finger. On a phone that's where taps start landing on the wrong option.

## Causes found in the booking form
1. **Jumping from Delivery back to Collection (confirmed in the code).** The whole booking form is one form. Pressing Enter or "Go" on the phone keyboard while typing an address submits it. If anything on an earlier step is incomplete, the form sends you back to that step, usually Collection. If everything is complete, it could book before you meant to.
2. **Taps selecting the wrong option (likely, not yet reproduced).** The dropdowns (number of bikes, bike type, address book) and the date pop-ups come from a library version with a known touch bug. The list opens under your finger, and the same tap then picks whatever option sits there. It shows up more on narrow, split-screen windows, where the list covers the button you tapped.

## Changes
1. **The Enter / Go key never submits the booking.** In the address and contact boxes it moves to the next box, or picks the highlighted address suggestion. Only the "Create Order" / "Book" button books.
2. **Dropdowns and date pickers ignore the tap that opened them.** A choice only counts from a fresh tap after the list is open. This applies to every dropdown and date pop-up across the site, not just booking, because they all share the same parts.
3. **Update the dropdown and pop-up libraries** to the versions that fix the touch bug.
4. **Lists open below or above the button, never on top of it**, so the button you tapped stays visible.
5. **Test like the customer.** A touch-screen browser at Fold split-screen size (about 340–560px wide): tap through bike count, bike type, dates, address search and step changes, and confirm each tap picks what was tapped and no step jumps back.

## Technical details
- `CreateOrder.tsx`: add `onKeyDown` on the `<form>` that calls `preventDefault` for Enter when the target is an `input`, `select` or other non-textarea, non-button element. Move focus to the next focusable field instead.
- `AddressSearchInput.tsx`: Enter picks the highlighted suggestion and arrow keys move through them. Enter never reaches the form.
- `src/components/ui/select.tsx`:
  - `SelectContent` gets `position="popper"`, `sideOffset` and `avoidCollisions`, so the list doesn't open over the trigger
  - add a tap-through guard: ignore item `pointerup` within about 300ms of opening if the pointer type is touch
- Same guard for the shared `Popover` (calendar, contact selector) and `DropdownMenu`.
- `bun add @radix-ui/react-select@latest @radix-ui/react-popover@latest`, then check the build and the existing tests.
- Playwright: Galaxy Fold profile (`hasTouch`, `isMobile`) at widths 344 and 540; tap with `page.touchscreen.tap`; assert the selected values and the active tab after each step.
