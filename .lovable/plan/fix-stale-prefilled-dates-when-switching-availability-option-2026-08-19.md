# Fix: stale prefilled dates when switching availability options

## Problem
On the business availability pages, "Bike is available now" prefills the next 7 open days plus an opening-hours note. If the user then clicks "← Back to options" and picks "Bike isn't available yet", those prefilled dates and the note stay in the form, so they submit dates they never chose.

## Fix
In `src/pages/SenderAvailability.tsx` and `src/pages/ReceiverAvailability.tsx`:

- Keep track of the auto-generated note text when "available now" prefills the form.
- When the user clicks "← Back to options", reset the selection: clear dates, remove the auto-generated note (leaving any text the user typed themselves), and set mode back to `unset`.
- When the user picks "isn't available yet" / "later", also start from a clean selection so nothing carries over from a previous "available now" click.
- No change to the "available now" behaviour itself, and no change to submission logic.

## Answer to your second question
Yes — this works on the flow straight after booking. After a business account creates an order, `CreateOrder` redirects to `/sender-availability/:orderId`, which is the same page, and the option cards render from the server-provided business flags on the public order payload. The fix applies there too.

## Technical notes
- Both pages hold `mode` in local state and use `setDates` / `setNotes` from the `useAvailability` hook; the reset is a small local state helper in each page, no hook or service changes.
