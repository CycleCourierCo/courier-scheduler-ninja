## Add timeslot email badges to the top dates section

In `src/pages/OrderDetail.tsx` around the "Collection Date" / "Delivery Date" headings (lines ~1300 and ~1320), render the `EmailDeliveryStatus` badge next to each heading so the timeslot email status is visible at the top of the order page.

### Changes (single file: `src/pages/OrderDetail.tsx`)

1. Wrap the **Collection Date** `<h3>` in a flex container and render:
   ```tsx
   <EmailDeliveryStatus orderId={id} side="sender" emailType="timeslot" />
   ```
   next to it.
2. Do the same for the **Delivery Date** `<h3>` with `side="receiver"` and `emailType="timeslot"`.

The badge already renders "No email sent" when nothing exists, so it stays unobtrusive before any timeslot send. No other files change.

### Out of scope
- No changes to `TimeslotSelection` (badge still shown there too).
- No styling or layout changes beyond the heading row.
