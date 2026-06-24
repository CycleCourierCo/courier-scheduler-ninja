## Show event date/time on the badge

Update `src/components/order-detail/EmailDeliveryStatus.tsx` so the badge displays when the top event happened, in addition to the status label.

### Change
- After computing `top`, format `top.created_at` in `Europe/London` as a compact string (e.g. `24 Jun, 14:32`) using `toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })`.
- Render it inside the badge after the status label, in a muted/smaller span so the status itself remains the primary signal. Example:
  `Email Clicked · 24 Jun, 14:32`
- Tooltip history stays as-is (full date + time per event).

### Out of scope
- No other components, no styling system changes, no logic changes to ranking or scoping.
