# Fix blank white screens and security-software blocking

Customers on Safari (and anyone behind strict antivirus or content filters) can end up on a completely white page with no message. Four confirmed causes in the current code.

## What's going wrong

**1. Private/blocked storage crashes the app on Safari**
Two places read browser storage the moment the app starts up: the theme setting and the sign-in client. When Safari blocks storage (private browsing, "prevent cross-site tracking", or a security extension), that read fails and the whole page dies before anything can be drawn — hence pure white, no error message.

**2. There is no message when the app's own files can't load**
The page is an empty shell that only fills in once the app code downloads. If antivirus, a corporate filter, or a stale cached file blocks that download, the visitor is left staring at white with no explanation and no reload option. The existing error screen lives *inside* the app, so it can never appear in this case.

**3. Everything loads in one giant file**
Every single page in the portal — around 90 of them, including maps, PDF and spreadsheet tooling — is bundled into one download that even a customer just checking a tracking link must fetch. That's slow, more likely to be interrupted, and is the classic cause of blank pages on older iPhones.

**4. Third-party addresses that filters commonly block**
Map pin images are pulled from `raw.githubusercontent.com` and `cdnjs.cloudflare.com`. GitHub raw content is routinely blocked by corporate/AV filters, so maps break for those users. Error reporting also has no protection against being blocked.

## The fix

1. **Make storage access safe.** Wrap theme and session storage reads/writes so a blocked or full store degrades to "not remembered this time" instead of crashing. Add a safe in-memory fallback for the sign-in client so customers can still use a tracking or availability link in private browsing.
2. **Add a real fallback screen in the page shell.** Plain HTML/CSS that shows immediately, is replaced by the app when it loads, and if the app hasn't started within a few seconds shows: what happened, a Reload button, a hint that security software or an ad-blocker may be blocking it, and the phone/email contact. Also catch any startup failure and show the same screen.
3. **Split the download by page.** Load each page only when visited, keeping customer-facing pages (home, tracking, availability, repair offer) in a small first download. Show a lightweight loading state between pages, and handle "a page file failed to load" (common after a new release) with a one-time automatic refresh instead of a white screen.
4. **Self-host the map pin images** from the project's own assets so filters can't break the map, and remove the outdated map-setup call that no longer does anything in the current map library.
5. **Replace `crypto.randomUUID` with a safe helper** (7 places). It doesn't exist on older Safari or over plain HTTP, and each use currently throws.
6. **Keep error reporting non-fatal** so a blocked reporting endpoint never affects the customer.

## Technical detail

- `src/contexts/ThemeContext.tsx`, `src/integrations/supabase/client.ts`: new `src/lib/safeStorage.ts` implementing the Supabase storage interface with try/catch + memory fallback.
- `index.html`: static `#app-fallback` markup inside `#root`, inline styles, `window.addEventListener('error'/'unhandledrejection')` guard, and a timeout check for whether React mounted. `<noscript>` message in `<body>`.
- `src/App.tsx`: `React.lazy` + `Suspense` for all admin/staff pages; eager imports only for `Index`, `TrackingPage`, `Sender/ReceiverAvailability`, `RepairOffer`, `NiPartnerUpload`, `Auth`, `NotFound`. Add a `vite` `manualChunks` grouping for heavy vendors (leaflet, pdf, xlsx, recharts).
- Chunk-load recovery: catch `Failed to fetch dynamically imported module` / `Importing a module script failed`, then `window.location.reload()` once guarded by a `sessionStorage`-free flag.
- `src/components/timeslips/TimeslipMapPreview.tsx` and other Leaflet users: bundle marker PNGs via ES imports; drop the no-op `whenCreated` prop in favour of a `ref`/`useMap` bounds effect.
- New `src/lib/uuid.ts` (`crypto.randomUUID` when available, else `getRandomValues`-based v4, else `Math.random` fallback) used in the 7 call sites.
- No backend, database, or business-logic changes.
