# Cool feature ideas — innovation backlog

A shortlist of distinctive features that fit the existing platform, grouped by effort and impact. Pick one or two to build next.

## Quick wins (ship in a session)

### 1. Bike Passport — shareable chain-of-custody report
Every moved bike gets a public-ish "passport" page (UUID-gated, like repair offers) that shows:
- Collection and delivery photos
- Inspection PDI summary
- Driver / depot / storage bay timeline
- Current status and location

Why it's cool: turns a logistics record into a trust asset that sellers can share with buyers, reducing "where's my bike?" support.

Build: reuse `collectionPhotos`, inspection notes, and order tracking; add `/bike-passport/:orderId` route and a QR code on the order detail / label.

### 2. Route weather intelligence
On the route builder / timeslot dialog, show weather warnings for each stop's date/time (rain, high winds, freezing). Suggest protective cover or flag risky e-bike deliveries.

Why it's cool: small operational edge that prevents damage and looks professional.

Build: call a free weather API (Open-Meteo, no key needed) from an edge function; cache by postcode+date; render badges next to stops.

### 3. Collection readiness score
For each order, score how "ready" it is for collection based on data completeness: address geocoded, photos uploaded, availability set, bike details filled, special instructions, access restrictions. Show a 0–100 ring on the order card.

Why it's cool: gamifies data quality and lets planners spot problem jobs before the driver leaves.

Build: client-side scoring function using existing order fields; no DB changes.

## Medium features (a few days)

### 4. Predictive maintenance suggestions
When a bike is checked in for inspection, suggest likely upcoming service based on brand/model/value + mileage/age if known, and the existing labour times catalogue.

Why it's cool: turns Cycle Courier from a mover/repairer into a proactive bike health advisor.

Build: add a `bike_service_intervals` lookup or use the existing labour times; surface a "Recommended soon" panel in `BicycleInspections.tsx`; optionally add to customer invoice upsells.

### 5. Carbon saved counter
Track CO2 avoided by using bike courier transport instead of a diesel van, per order and globally. Add a customer-facing "This delivery saved X kg CO2" badge and an admin dashboard tile.

Why it's cool: strong marketing angle; customers love sustainability metrics.

Build: estimate CO2 per mile by transport mode; store on order; aggregate in analytics; show on tracking page.

### 6. Live route "theatre mode"
A public, read-only full-screen view of today's route for the depot / reception: driver positions, ETA, next stop, completed stops. Auto-refreshes.

Why it's cool: gives the workshop a live situational awareness screen without login friction.

Build: new read-only route endpoint using existing Shipday/location data; big-screen responsive layout; optional TV-mode toggle.

### 7. AI damage comparison at delivery
Compare collection photos with delivery photos using a vision model to flag potential new scratches, dents, or damage. Generate a confidence score and highlight crops.

Why it's cool: automates the most contentious customer service scenario ("it wasn't damaged when I sent it").

Build: edge function that fetches two photo sets and calls Lovable AI Gateway vision model; returns similarity/damage flags; store result on order.

## Big bets (strategic)

### 8. Dynamic pricing engine
Surge/adjust pricing automatically based on real-time factors: route density in the area, driver availability, bike value, urgency, weather, and NI/ferry constraints. Show the customer a "price lock" countdown.

Why it's cool: maximizes margin on high-demand days and fills quiet slots with discounts.

Build: pricing service that ingests current route load, driver capacity, and demand signals; replace static price lookup with calculated quote; admin override dial.

### 9. Peer-to-peer overflow courier marketplace
When internal capacity is full, offer vetted external couriers the chance to claim jobs. Track them as "partner drivers" with their own portal, proof-of-delivery, and payout.

Why it's cool: scales without buying more vans; turns the platform into a network.

Build: partner driver role, partner portal, job claim flow, payout tracking, separate proof-of-delivery path.

### 10. Autonomous delivery-window negotiation
An AI agent texts/emails the receiver when the driver is a set distance away and offers a few arrival windows. The receiver replies or clicks a link; the system updates the route.

Why it's cool: reduces failed deliveries and support calls while feeling futuristic.

Build: WhatsApp/email bot using SendZen/Resend; edge function parses replies; integrates with existing route/timeslot system.

## Recommendation

Start with **Bike Passport** + **Route weather intelligence** — both are quick, highly visible to customers, and reuse existing data. Then move to **AI damage comparison** because it directly reduces disputes and leans on the AI infrastructure already in the project.
