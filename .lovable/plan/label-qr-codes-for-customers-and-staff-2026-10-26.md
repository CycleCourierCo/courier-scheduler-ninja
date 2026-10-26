# Label QR codes for customers and staff

## Starting point
Every label QR already opens `booking.cyclecourierco.com/tracking/<CCC number>`. That link stays exactly as it is, so labels already printed keep working. What changes is what happens after the page opens, based on who is scanning.

```text
Scan label QR -> /tracking/CCC...
   |-- not signed in ............ customer tracking page (as today) + "Staff? Sign in"
   |-- customer who owns order .. tracking + their order details
   |-- loader ................... Bike card: put in bay / load onto van
   |-- driver (route started) ... Stop card: mark collected / delivered + proof
   |-- mechanic ................. Inspection / repair for that bike
   |-- admin / customer service . Order page, with quick actions
```

## Who sees what

**Customers and the public**
- Current tracking page: status, timeline, live ETA link while the bike is on its way.
- Proof of delivery stays behind the postcode check.
- A small "Staff sign in" link at the bottom. Staff only have to sign in once on their phone.

**Loaders (in the depot)**
- Bike card: CCC number, bike, sender to receiver, current bay or van, any notes.
- Buttons: "Put in bay" (choose a bay), "Load onto van X" (today's assigned vans), "Unload to depot".
- Warnings: wrong van for today's route, bike still waiting for inspection/repair, order cancelled.

**Drivers**
- If the bike is on the driver's started route: stop card with "Collected" or "Delivered", photo and signature (uses the existing proof-of-delivery screen, which still saves when there's no signal).
- If it isn't on their route: a clear "Not on your route today" message. They can still see the bike's basic details.
- Before they've started the route at the depot, they can only see the loading check ("this bike belongs on your van").

**Mechanics**
- Opens the bike's inspection, or starts one if none exists yet.
- Shows repair status and parts.

**Admins and customer service**
- Opens the full order page with quick actions (add a note, change status, reprint the label).

## In-app scanner
- A "Scan" button in the staff menu and on the Loading and Driver pages opens the phone camera.
- Continuous mode for loading a van: scan bike after bike, see a running tick list, then confirm everything in one save (uses the existing one-call van loading).
- Typing the CCC number by hand also works.

## Scan history
- Every staff scan is recorded: who, when, role, what they did, and the phone's rough location if allowed.
- Shown on the order timeline ("Scanned onto van AB12 CDE by Sam, 07:42"). Gives a chain of custody for damage claims.

## Safety rules
- What you're allowed to do is checked on the server, never just on the phone.
- Customers only ever see the public-safe tracking information. No driver names or other customers' details.
- Each action matches the role's current permissions. For example, drivers can only change stops on their own started route.
- Collected/delivered taps go through the same path as today, so customer messages work the same way.

## Phases
1. **Smart landing:** route `/tracking/:id` by who is signed in, the staff sign-in link, and read-only bike cards for every role.
2. **Loader actions:** put in bay, load onto van, unload, wrong-van warnings, and scan history.
3. **Driver actions:** collected/delivered with proof from a scan, plus the loading check before depot start.
4. **In-app scanner:** camera scanning, continuous van-loading mode, typing the number by hand.
5. **Mechanic and admin shortcuts,** plus scan history on the order timeline and in claims.

## Questions to confirm before building
- When a driver scans a bike from someone else's route, should they be allowed to collect it? The plan assumes they're blocked, with a "tell the office" message.
- Should customers who scan see the extra details meant for signed-in customers, or always just the public page?

## Technical details
- Keep `labelTrackingUrl` unchanged. TrackingPage checks the session and role (`user_roles` via has_role), then shows a role panel above or in place of the public view.
- New table `label_scans` (order_id, user_id, role, action, lat/lon, created_at). It is written by a security-definer `record_label_scan` function. Staff can read it; it can never be changed.
- Loader actions reuse `load_orders_onto_van` and the storage-bay updates. Driver actions reuse the `driver_today_stops` / delivery-proof queue.
- Scanner: the browser's `BarcodeDetector`, falling back to a small JS QR decoder. In the Capacitor app it uses the native camera through `src/lib/driverApp/native.ts`.
- Add the Scan page to `ADMIN_MENU_SECTIONS` and the route permissions, and to the floor-controls list for the bigger 48px buttons.
- Tests: role-to-panel mapping, and blocking a driver who isn't on the route.
