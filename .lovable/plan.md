# Northern Ireland Orders

## 1. Classify destination region from the address (no extra API call)

Geoapify's autocomplete response already contains `properties.state`, which for UK addresses is the constituent country — "England", "Scotland", "Wales" or "Northern Ireland". `AddressForm.tsx` currently reads `properties.county` into the County field and throws `properties.state` away.

- Add a hidden `region` field to the address object, populated from `properties.state` when a suggestion is picked.
- Derive `is_northern_ireland` from `region === "Northern Ireland"`, with a `BT` postcode-prefix fallback for manually typed addresses (all NI postcodes are BT).
- Persist `destination_region` and `is_northern_ireland` on the order at creation, in all three creation paths (Create Order page, public `orders` API edge function, Shopify webhook) via one shared helper.
- Admin override toggle on the order detail page for edge cases.

## 2. Shipday: divert the delivery leg

For NI orders, no Shipday delivery job is created to the receiver's address. The delivery leg goes to:

```text
City Air Express
Operations.man@cityairexpress.com
+44 7730 145621
Unit 1 Ordinal Street, Trafford Park, Manchester, M17 1GB
```

- The delivery job's instructions carry the true NI receiver name, address, phone and tracking number so City Air Express can book the onward leg.
- Collection leg unchanged.
- `CITY_AIR_EXPRESS` added to the depot constants, shared by the Shipday function and the emails.

## 3. Emails

- **"Your Bicycle Delivery":** unchanged for GB. For NI it is also sent to City Air Express, with an extra block containing the full NI receiver details plus tracking number.
- **Availability / dates email:** for NI, goes to City Air Express instead of the NI receiver.
- The standard receiver notification still goes to the real NI receiver.
- Applied in both `emailService.ts` and the `orders` edge function so API orders match.

## 4. Pricing (+£120 per bike)

- NI bike line price = normal bike-type price + £120, per bike, rolled into the single line.
- QuickBooks: the invoice builder sets `UnitPrice = product price + 120` and the description notes "Northern Ireland"; `Amount = (price + 120) × quantity`.
- Same uplift in the customer-facing quote at booking so it matches the invoice.

## 5. Foam My Bike

New "Foam My Bike" tab on the Box My Bike page, listing NI orders through their own stages:

```text
Pending collection -> Pending foaming -> Foamed, ready for delivery
-> Delivered to ferry -> Delivered in Northern Ireland
```

- New `foam_status` column plus per-stage timestamps, mirroring the box-my-bike stage pattern (forward/back buttons, webhook events).
- Final "Delivered in Northern Ireland" stage is set manually and supports uploading proof photos, shown on the card and public tracking.

## 6. Job scheduling markers

- Scheduling cards and the Route Builder show "Bike foamed" (green) or "Pending foaming" (amber) for NI jobs.
- Adding a pending-foaming job to a route triggers a confirmation warning so it isn't booked in early.

## 7. Tracking

- Once the Shipday delivery to City Air Express completes, public tracking shows "Delivered to ferry — awaiting transport across the Irish Sea" rather than "Delivered".
- The manual "Delivered in Northern Ireland" stage adds the final tracking event with any uploaded photos.

## Technical notes

- **No Boundaries API call.** Region comes from the existing geocode response; BT postcode is the fallback.
- **Migration:** add `destination_region text`, `is_northern_ireland boolean default false`, `foam_status` (new enum), `foam_*_at` timestamps to `orders`; extend the order status enum with `delivered_to_ferry`; create a storage bucket for foam delivery photos with staff-write / public-read policies.
- **QuickBooks:** no new product needed — uplift rides on the existing bike-type line.
- Files touched: `AddressForm.tsx`, `src/types/order.ts`, `CreateOrder.tsx`, `orders`, `shopify-webhook`, `create-shipday-order`, `create-quickbooks-invoice`, `emailService.ts`, `BoxMyBikePage.tsx`, `SchedulingCard.tsx`, `RouteBuilder.tsx`, `TrackingTimeline.tsx`.
