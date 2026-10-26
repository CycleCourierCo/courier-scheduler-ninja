# Native driver app (App Store + Google Play)

Build a phone app for drivers using Capacitor. It wraps the portal's driver screens in a real native app and adds access to phone features. Everything stays in this one project, so the app and portal share logins, orders and routes.

## What drivers get

1. **Today's route & stops**
   - The driver's linked saved route for today, listed in stop order with customer, address, time window and bike.
   - Big buttons: Navigate (opens Google/Apple Maps), Call customer, Mark collected / delivered.
   - Opens automatically after sign-in. Larger floor-style controls.

2. **Proof of delivery**
   - At each stop: take one or more photos with the phone camera and capture a signature on screen, plus an optional note.
   - Saved against the order and visible to staff on the order page.
   - If the signal drops, the proof is saved on the phone and uploaded when back online.

3. **Share live location**
   - While a driver is "On shift", the app sends their position every minute or two, even with the screen off.
   - Shows on the Live Van Map next to the Radius trackers, and is used as a fallback when a van tracker has no signal.
   - A clear on-screen indicator while sharing, and it stops automatically at end of shift. Drivers must allow location access.

## What you'll need to do (one-off)
- Apple Developer account (about GBP 79/year) and Google Play account (about GBP 20 once).
- A Mac with Xcode for the iPhone build, Android Studio for Android.
- Export the project to GitHub and run a few setup commands. I'll give step-by-step instructions.
- Store listings need a privacy policy that mentions location and photos, so the current policy needs updating.

## Technical details
- Capacitor: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`; `capacitor.config.ts` with appId `app.lovable.p252363c3e6734761adce5be670d61f60`, appName `courier-scheduler-ninja`, hot-reload server URL for development.
- Plugins: `@capacitor/camera`, `@capacitor/geolocation` plus a background-geolocation plugin for screen-off tracking, `@capacitor/preferences` for the offline queue.
- New `/driver/today` page built from timeslip `saved_route_id` and the route's frozen plan.
- New `delivery_proofs` table (order id, driver, photo paths, signature path, note, location, time) with RLS: drivers insert/read their own proofs; admin, CS and route planners read all. Files go in a private storage bucket.
- New `driver_positions` table (driver, time, lat/lng, accuracy), 90-day retention matching van history. Drivers can insert only their own rows; fleet staff can read. Merged into the Live Map in `liveTracking.ts`.
- Status updates use the existing order collected/delivered flags so Shipday, webhooks and emails fire as they do now.
- Add the new driver route to the larger floor-control screen list and the menu.

## Order of work
1. Capacitor setup and Today's route page.
2. Proof of delivery with offline queue.
3. Background location sharing and Live Map merge.
4. Store-submission checklist and privacy policy wording.
