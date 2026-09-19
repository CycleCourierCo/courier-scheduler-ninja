# Fix sender and receiver heading overlap

## Changes
- Rework each contact heading into a responsive layout so the title always keeps its own space and the action buttons cannot cover it.
- Keep **Send Review** and **Edit Contact** together, but move them beneath the title when a two-column contact panel is too narrow.
- Allow the two contact columns to collapse sooner on medium-width screens, while retaining the side-by-side desktop view when there is enough room.
- Apply the same treatment to both editable staff contacts and read-only contact details for consistency.

## Scope and verification
- Presentation only; no contact editing, review messaging, permissions, or order data logic changes.
- Verify the order page at the screenshot width, narrow mobile width, and wide desktop width with no overlap or horizontal scrolling.
- Run the production build after implementation.
