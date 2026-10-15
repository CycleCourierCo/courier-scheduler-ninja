# Edit customer dates directly on the order page

## What changes
On an order's page, under **Sender Availability** and **Receiver Availability**, staff who can already reset dates (admins and route planners) get a new **Edit Sender Dates** / **Edit Receiver Dates** button.

It opens a popup with a calendar where you can:
- tick or untick any days (no minimum of 7, past days blocked)
- see the current dates pre-selected
- press **Save dates** (shows "Saving…", can't be pressed twice) or Cancel

Saving:
- replaces that side's dates straight away and marks them as confirmed now
- sends no email to the customer
- leaves Reset, Resend email and Copy link working as today
- works even when the customer hasn't given any dates yet (so you can enter dates taken over the phone)

The "expired dates" flag on that leg clears itself on the nightly check once a future date is saved.

## Technical details
- New `src/components/order-detail/EditAvailabilityDialog.tsx`: shadcn Dialog + multi-select Calendar (mobile-friendly cell sizes like the My availability fix), dates stored as `YYYY-MM-DD` strings per project rule.
- `src/pages/OrderDetail.tsx`: add the two buttons behind the existing `isAdminOrRoutePlanner` check; on save update `orders.pickup_date` + `sender_confirmed_at` (or `delivery_date` + `receiver_confirmed_at`), then refetch the order and toast.
- Also upsert `order_leg_availability` back to `active` for that leg when a future date is saved, so the expired badge disappears immediately rather than overnight.
- No database changes — staff already have update rights on orders.
