# Isle of Man ferry process (copy of Northern Ireland)

## What you'll get
Isle of Man (IoM) orders work exactly like Northern Ireland orders, in both directions, with Freight Hub as the ferry partner:

- Freight Hub, Unit 7, Alexandra Industrial Estate, Widnes, WA8 7AH, United Kingdom
- hello@freighthub.im, +44 7624 246112
- Surcharge: £180 per bike, including VAT

**To Isle of Man:** our driver drops the bike at Freight Hub in Widnes, not at the customer's door. Freight Hub gets the same notification email and partner link as City Air Express gets for NI, and uses it to upload labels and add details.
**From Isle of Man:** Freight Hub collects from the customer. We then collect the bike from Widnes and deliver it on the mainland as normal.

Everywhere NI is handled now, IoM will be handled too: spotting the address (IM postcodes / "Isle of Man"), the surcharge at booking and on quotes, the pricing and terms pages, route planning and ETAs (Widnes stop instead of the island address), Shipday jobs, labels and loading/storage locations, the tracking page and journey steps, customer emails/WhatsApp and Email Centre entries, availability and expiry handling, inbound "box my bike" and foam sections, the order details editor, the API and the Shopify booking, QuickBooks invoice lines and internal reports.

## Things to confirm
- **VAT:** I'll treat £180 as the gross price (£150 + VAT) on invoices. I'll leave NI's £120 unchanged.
- **Wording:** customer messages will say "Isle of Man" and "Freight Hub" wherever NI messages say "Northern Ireland" and "City Air Express".

## Technical details
- Build a general ferry region setup (`northern_ireland` | `isle_of_man`) with per-region partner, postcode rule (`^IM\d`), surcharge and label text. Mirror it in `supabase/functions/_shared`. Existing NI functions become wrappers, so NI behaviour stays the same.
- Migration: add `orders.ferry_region` text (NI backfilled from `is_northern_ireland`/`ni_direction`), reusing `ni_direction` and `ni_partner_token` for direction and partner links. Partner RPCs and `ni-partner-label-upload` look up the order's region partner. No new grants for anon, and new functions revoke PUBLIC/anon.
- Update every NI-aware file (about 60, including RouteBuilder, niDelivery, send-order-updates, shipday-webhook, send-ferry-partner-notification, ferryPartnerEmail, orders API, create-quickbooks-invoice, public-track, labelUtils, journeyStages, NorthernIrelandEditor, InboundNiSection). Each will branch on the region and stop assuming NI.
- Tests: postcode detection (IM vs BT), £180 surcharge, Widnes stop coordinates for IoM ferry legs, NI still resolving to Manchester.
- Geocode the Widnes address once and store the coordinates in the depot constants.
