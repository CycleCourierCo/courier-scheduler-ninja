# Show fill dates and sites for unmatched registrations

## Change
- Under each registration in **Registrations that need matching**, show every fill attached to that registration.
- Each fill will display its date and fuel station/site name, so registrations with multiple fills remain clear.
- Keep the existing fill count, litres, spend, suggested vehicle, matching control and **Not ours** action unchanged.
- Use the existing fuel transaction date and site already saved from the invoice; no database change is needed.

## Technical details
- Extend each unmatched-registration analysis item with its underlying fills (`date` and `siteName`).
- Render the fill details as a compact list that wraps cleanly on the current mobile layout.
