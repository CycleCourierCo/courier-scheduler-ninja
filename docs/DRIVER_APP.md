# Driver app (iPhone and Android)

The driver app is this portal wrapped with Capacitor. It opens on **Today's Route** (`/driver/today`).

## One-off setup on your computer
1. Export the project to GitHub, then `git pull` it.
2. `npm install`
3. `npx cap add ios` and/or `npx cap add android`
4. `npx cap update ios` / `npx cap update android`
5. `npm run build`
6. `npx cap sync` (repeat after every `git pull`)
7. `npx cap run ios` (Mac + Xcode) or `npx cap run android` (Android Studio)

While testing, `capacitor.config.ts` points the app at the live preview so changes appear without rebuilding. **Before submitting to the stores, remove the `server` block** so the app uses its own built copy.

## Phone permissions to add

**iOS – `ios/App/App/Info.plist`**
- `NSCameraUsageDescription`: "Take photos as proof of collection and delivery."
- `NSPhotoLibraryAddUsageDescription`: "Save proof photos."
- `NSLocationWhenInUseUsageDescription` and `NSLocationAlwaysAndWhenInUseUsageDescription`: "Share your location with the office while you're on shift."
- Background Modes → tick **Location updates**.

**Android – `android/app/src/main/AndroidManifest.xml`**
- `CAMERA`, `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`.

## Store checklist
- Apple Developer account (~£79/yr), Google Play developer account (~£20 once).
- App icon (1024×1024) and screenshots of Today's Route and the proof screen.
- Privacy policy URL that covers location and photos (suggested wording below).
- Apple review: provide a test driver login with a route linked for the review day.
- Google Play: complete the "background location" declaration with a short video showing Start shift → location notice → End shift.

## Suggested privacy policy wording (please check before publishing)
> **Driver app.** If you work for us as a driver, our app collects your phone's location only while you have pressed "Start shift", so the office can see where deliveries are and update customers. Location sharing stops when you press "End shift" and at the end of the day. Location history is kept for 90 days. Photos and signatures you capture at a stop are stored securely as proof of collection or delivery and are only visible to our staff.
