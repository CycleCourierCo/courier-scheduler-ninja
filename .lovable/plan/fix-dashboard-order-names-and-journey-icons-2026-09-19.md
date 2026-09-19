# Fix dashboard order names and journey icons

## Changes
- Delay the dashboard order row’s wide layout until there is genuinely enough horizontal space, so medium-width screens no longer squeeze sender and receiver names into tiny fragments.
- Give the sender-to-receiver line a dedicated full-width area at compact widths and preserve meaningful truncation only for genuinely long names.
- Keep tracking number, account, bike, dates, status and action buttons readable without horizontal scrolling.
- Replace the journey strip’s position-based symbols with clear milestone-specific icons for booked, collection, transit and delivery.
- Correct the milestone state display so an uncollected order does not visually imply that a collection vehicle milestone has already been reached.
- Harden the shared compact journey strip spacing and connector alignment without changing tracking data or order status logic.

## Verification
- Check the dashboard at the reported 895px viewport, narrow mobile and wide desktop widths.
- Confirm names remain readable, all four journey steps align, and there is no horizontal overflow.
- Run the production build.
