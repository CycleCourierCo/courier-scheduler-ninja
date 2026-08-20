# Fix the Driver tab UI in Edit User

The Driver tab in User Management → Edit User is unreadable on mobile: labels wrap one word per line, inputs collapse to a sliver, and the two toggles ("Uses Own Van" / "Active") overlap each other. The tab content is being squeezed into two columns even on a 360px-wide screen, and each field box shrinks to its content instead of filling the row.

## What changes

- Driver tab fields stack in one full-width column on phones and go to two columns only from `sm` upwards.
- Every field wrapper gets a minimum-width reset so labels stay on one line and inputs fill the available width.
- "Uses Own Van" and "Active" become their own full-width rows with the switch on the right, so they can no longer sit on top of each other.
- Default Vehicle keeps its full-row span and helper text.
- Remove the leftover empty fragment wrapper inside the grid (dead markup from an earlier edit).
- The dialog itself becomes width-safe on small screens (`w-[95vw]` with the existing `max-w-3xl` cap) so no tab content is pushed outside the viewport.
- The tab strip keeps its horizontal scroll but gets consistent trigger padding so "Driver"/"Licence" don't clip.

No field, label text, ordering, or save logic changes — presentation only.

## Technical notes

- Single file: `src/components/user-management/EditUserDialog.tsx`.
- `TabsContent value="driver"`: grid becomes `grid-cols-1 sm:grid-cols-2 gap-4`, each child `space-y-2 min-w-0`, inputs `w-full`; `col-span-2` becomes `sm:col-span-2` so it doesn't fight the single-column mobile layout.
- Switch rows: `flex items-center justify-between gap-3 rounded-md border p-3 sm:col-span-2`.
- Same `min-w-0` / `sm:col-span-2` treatment applied to the Basic, Address and Pay tabs where `grid-cols-2` is hardcoded, since they have the same squashing risk.
