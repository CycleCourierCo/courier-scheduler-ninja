# Fix the Northern Ireland partner upload link

Two separate problems are behind what you saw.

## 1. Wrong web address in the email

The partner email builds its "Upload label and BFS number" link from a fallback address (`courier-scheduler-ninja.lovable.app`) instead of the live booking site. Every other customer-facing email in the project already uses `https://booking.cyclecourierco.com`.

Fix: make the ferry partner email use the same booking address as the repair-offer and order-update emails, so the button always points at `https://booking.cyclecourierco.com/ni-partner/<order id>`.

## 2. The page isn't live yet

The upload page and its address exist in the app, but the live site still runs the previous published version, which is why the link showed "404 Page Not Found". Once the email fix is in, the site needs publishing so the upload page is reachable on the live address.

After that, resending the partner email (or reopening the link from the order page) will open the upload page correctly.

## Technical notes

- `supabase/functions/_shared/ferryPartnerEmail.ts`: replace the `courier-scheduler-ninja.lovable.app` fallback in `buildPublicAppUrl()` with `https://booking.cyclecourierco.com` (keeping the `PUBLIC_APP_URL` override).
- `src/lib/publicAppUrl.ts`: same fallback change, so the copy-link button on the order detail page matches.
- Route `/ni-partner/:orderId` is already registered in `src/App.tsx` outside `ProtectedRoute`; no routing change needed — the 404 is a publish gap.
