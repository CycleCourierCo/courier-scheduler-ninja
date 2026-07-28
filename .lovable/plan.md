## Goal
Reword two tracking timeline entries so they read as "availability received" rather than "dates confirmed".

## Change
In `src/components/order-detail/TrackingTimeline.tsx` (lines 95–111):

- Sender event:
  - Title: `Collection Availability Received`
  - Description: `Thank you. You've submitted your preferred collection dates. We'll confirm your actual collection date shortly.`
- Receiver event:
  - Title: `Delivery Availability Received`
  - Description: `Thank you. You've submitted your preferred delivery dates. We'll confirm your actual delivery date shortly.`

Timestamps, icons and ordering stay exactly as they are.
