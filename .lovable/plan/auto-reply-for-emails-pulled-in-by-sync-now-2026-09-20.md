# Auto-reply for emails pulled in by "Sync now"

## Goal
When staff press Sync in the inbox, every email that comes in as a result should get the "we've got your message" confirmation, not just the ones that happen to create a brand new ticket within the last hour.

## Current behaviour (confirmed in code)
- Sync calls `cs-resend-fetch`, which imports each email through the shared ingest step.
- The ingest step only sends a confirmation when the email creates a **brand new** ticket, and it fires it in the background so a sync can finish before the email is actually sent.
- A separate catch-up sweep afterwards only looks at email tickets created in the **last hour** that are still open and have no staff reply, so anything older that was missed never gets a confirmation.

## Changes
1. After each email is imported during a sync, send the confirmation for that ticket right there and wait for it, so the sync result reflects reality. The existing one-per-ticket guard stays, so a reply on a ticket that was already confirmed won't trigger a second email.
2. Widen the catch-up sweep from 1 hour to 7 days, still skipping closed tickets, tickets that already have a staff reply, and automated senders.
3. Return a count of confirmations sent in the sync response and surface it in the inbox toast ("Checked 4, imported 2, 2 confirmations sent").

## Technical notes
- Edit `supabase/functions/cs-resend-fetch/index.ts`: capture the conversation id returned by the ingest call, then `await sendTicketReceivedEmail(...)` per imported email, guarded by try/catch so one failed send doesn't abort the sync; adjust the `since` window and add `acks_sent` to the JSON response.
- Edit `src/services/customerServiceInboxService.ts` return type and the Sync handler in `src/pages/CustomerServiceInbox.tsx` to show the new count.
- Existing duplicate/loop protections (`ack_sent_at` claim, automated-sender check, Message-ID dedupe) are unchanged.
- Redeploy `cs-resend-fetch` after the edit.
