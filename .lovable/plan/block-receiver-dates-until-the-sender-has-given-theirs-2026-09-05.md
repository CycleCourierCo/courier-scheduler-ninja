# Block receiver dates until the sender has given theirs

## What changes

On the delivery-dates page (the link the receiver gets), if the sender has not yet picked their collection dates, the receiver no longer sees a calendar. Instead they see a short message:

- Title: "Awaiting sender dates"
- Text: "We're waiting for the sender to confirm when the bike can be collected. As soon as they do, we'll email you so you can pick your delivery dates."

Everything else on that page stays the same. Once the sender has confirmed, the page works exactly as it does today.

## Details

- File: `src/pages/ReceiverAvailability.tsx`
- Add a check after the order loads and before the existing inspection/workshop check: treat the sender as "not set" when the order's pickup dates are missing, not an array, or an empty array (the same value the page already uses to work out the earliest selectable date).
- Render the awaiting message via the existing status card used for these blocked states, so styling matches the current "being inspected and serviced" screen.
- No database, email or scheduling logic changes.
