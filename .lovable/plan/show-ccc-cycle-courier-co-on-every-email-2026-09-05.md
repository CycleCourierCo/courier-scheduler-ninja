# Show "CCC - Cycle Courier Co." on every email

Order confirmations show the name because they are sent with a display name. The availability emails (and a few others) are sent with only the raw address `Ccc@notification.cyclecourierco.com`, so the inbox falls back to showing "Ccc".

## What's wrong today

Confirmed by reading the code:

- The app passes a bare sender address on 14 places that trigger emails (all availability requests, date-confirmation emails, order updates, account-approval emails).
- The main send path uses whatever the app passes, and falls back to the bare address when nothing is passed — so those emails have no display name.
- The new-business-account emails also use the bare address.

Already correct (display name present): order/API confirmations, timeslot and loading-list emails, route reports, timeslips, internal reports, inspection approval, repair offers, receiver repair invoices, task assignments, weekly invoice report, ferry-partner emails, customer-service replies.

## The fix

Use `CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>` everywhere a sender is set:

- The 13 app-side send calls plus the account-approval email.
- The default fallback in the main send path, so anything missed still gets the name.
- The new-business-account emails.

Reply-to stays `Info@cyclecourierco.com` and the sending address is unchanged, so DNS and deliverability are unaffected. The name applies to new emails only — ones already in the inbox still show "Ccc".

## Technical notes

Files: `src/services/emailService.ts`, `src/pages/AccountApprovals.tsx`, `supabase/functions/send-email/index.ts` (default `from`), `supabase/functions/create-business-user/index.ts` (`FROM_EMAIL`). Redeploy `send-email` and `create-business-user`.
