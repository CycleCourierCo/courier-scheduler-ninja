# Keep every ticket email on one thread

## Problem

Right now only staff replies try to thread. The automatic "we've got your message" and "ticket closed" emails are sent with no thread information at all, so the customer's mail app shows them as brand new emails instead of part of the existing conversation. Our own sent emails also don't record their own identifier, so once we send two messages in a row the chain can break.

## What will change

- Every email we send about a ticket — staff reply, received confirmation, and closed confirmation — becomes part of the same email conversation in the customer's inbox.
- Closing a ticket replies on the existing thread rather than starting a new email.
- Any later message after closure (including if the customer replies and we answer again) stays on that same thread.
- Subjects stay consistent: the original subject with `Re:` and the ticket number, so threading also works in mail apps that group by subject. The closed email drops the extra "- ticket closed" suffix from the subject and says it in the body instead.

## Technical detail

New shared helper `supabase/functions/_shared/cs-thread.ts`:

- `buildThreadHeaders(supabase, conversationId, newMessageId)` — reads all messages on the conversation that have an `email_message_id`, in order, and returns:
  - `Message-ID`: a stable id we mint ourselves, `<cs-{messageId}@mail.cyclecourierco.com>`
  - `In-Reply-To`: the most recent existing message id on the ticket
  - `References`: the accumulated chain (capped to the first one plus the last ~10 to keep headers short)
- `threadSubject(conv)` — single source of truth: `Re: <original subject> [TCK-xxxx]`, never duplicating `Re:` or the ref.

Then:

- `_shared/cs-auto-email.ts`: `sendAndLog` calls `buildThreadHeaders` and merges the result with the existing `Auto-Submitted` header; both acknowledgement and closure use `threadSubject`. Persist the minted `Message-ID` into the inserted `cs_messages.email_message_id` (and `in_reply_to`) so it becomes part of the chain for later sends.
- `cs-send-message/index.ts`: replace the current single-last-inbound header logic with `buildThreadHeaders` + `threadSubject`, and store the minted `email_message_id`/`in_reply_to` on the outbound row.
- Inbound handling already matches `In-Reply-To` against `cs_messages.email_message_id`, so customer replies to any of our emails now land on the correct ticket without relying on the subject ref.
- No database migration needed — `email_message_id` and `in_reply_to` already exist on `cs_messages`.
- Redeploy `cs-send-message`, `cs-close-ticket`, `cs-send-ack`, `cs-resend-fetch`, `cs-inbound-email`, `cs-resend-inbound`.

Existing older tickets have no stored ids for our past outbound emails, so their first new message may still appear separately; everything after that threads.
