# Make the inbox taller without removing linked orders or tasks

## Correction

The requested change is vertical: the customer-service inbox and message history should use much more of the screen height. The ticket list, chat width, and right-hand information should not be removed or narrowed.

The current layout hides both the **Details** button and the entire right-hand panel below the large-screen breakpoint. At the current 1020px view, that makes the contact, linked order, order search, and tasks unavailable.

## Changes

- Increase the inbox vertically so it fills the available browser height beneath the site header, with only the message history scrolling.
- Keep the ticket list on the left and restore the right-hand details panel containing:
  - contact information
  - linked and suggested orders
  - order search/linking
  - conversation tasks and **New** task action
- Keep the right-hand panel available at laptop widths such as 1020px instead of hiding it just below 1024px.
- If space is genuinely too narrow, keep a visible **Details** control that opens the same linked-order/task content rather than making it inaccessible.
- Preserve the pinned conversation heading and reply box, existing filters, close-ticket behaviour, and independent scrolling in all three sections.
- Remove the width-focused/full-screen behaviour introduced by the previous interpretation; this change should increase length, not turn the chat into a wider view.

## Verification

- Check the inbox at the current 1020×674 view and a standard desktop size.
- Confirm linked orders and tasks are visible and usable.
- Confirm a long message history scrolls internally while the reply box stays at the bottom.
