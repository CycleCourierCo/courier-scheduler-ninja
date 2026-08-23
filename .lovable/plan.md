# SLA change to 4 days + delivery photo access fix

## 1. Move the collection and delivery SLA to 4 days

Today the performance metrics measure:

- Collection SLA: order created to collection within 24 hours
- Delivery SLA: collection to delivery within 48 hours
- Order to Delivery SLA: order created to delivery within 72 hours

New targets:

- Collection SLA: within 4 days (96 hours) of the order being created
- Delivery SLA: within 4 days (96 hours) of collection
- Order to Delivery SLA: within 8 days (192 hours), so the end-to-end figure stays consistent with the two 4-day legs

This is the same threshold used by the analytics cards, the collection and delivery time charts, and the per-customer performance leaderboard, so all three update together and every "Within 24 hours / 48 hours / 72 hours" label becomes "Within 4 days / 4 days / 8 days".

The customer-facing wording in emails already says "we typically collect within 2-4 working days of dates being agreed, and deliver within 2-4 working days of collection", which matches the new target, so that text stays as-is.

If you'd rather the end-to-end figure stay at a different number than 8 days, say so and I'll adjust that one line.

## 2. Security finding: anyone could view delivery photos

Confirmed on the live database: the private delivery photos bucket has a read rule that only checks which bucket the file is in and applies to anonymous visitors, so anyone who guessed a file path could open another customer's photos.

How photos are legitimately viewed today:

- Staff view them from the Foam My Bike screen
- A signed-in customer views them on their own order
- A public tracking visitor sees them only after passing the postcode check, which reveals the photo paths through the protected tracking function

The fix keeps all three working while closing the hole:

1. Add a small server endpoint that takes the tracking number and the postcode, re-runs the existing postcode verification, and returns short-lived signed links for that order's photos only. Nothing is returned if the postcode does not match.
2. Point the public tracking view at that endpoint instead of signing links in the browser.
3. Remove the blanket anonymous read rule from the bucket, leaving the existing owner-scoped and staff rules in place.

After this, guessing a file path returns nothing, and photos are only reachable by the order's owner, verified tracking visitors, and staff.

## Technical notes

- `src/services/analyticsService.ts`: threshold constants for the 24h/48h/72h comparisons plus the leaderboard aggregation counters.
- `src/pages/AnalyticsPage.tsx`, `src/components/analytics/CollectionTimeChart.tsx`, `src/components/analytics/DeliveryTimeChart.tsx`: label text.
- New edge function `get-foam-photo-urls` calling `get_public_order_with_proof` with the service role, then `createSignedUrls` on `foam-delivery-photos`.
- `src/components/order-detail/TrackingTimeline.tsx`: use the function when there is no signed-in session.
- Migration: drop the storage policy `Foam delivery photos readable for tracking`.
