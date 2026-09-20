# Instant responses for the customer service inbox

Add a library of ready-made replies staff can insert into the reply box with one click, plus automatic suggestions based on words in the customer's latest message.

## What staff will see

**In the ticket reply area**
- A "Instant responses" button above the reply box opens a searchable list of saved replies (grouped by category).
- Clicking one fills the reply box with its text (staff can still edit before sending). If the box already has text, the reply is appended.
- Suggested replies appear as small chips directly above the reply box when the customer's last message matches saved keywords — e.g. "where is my bike" suggests the tracking reply. Clicking a chip prefills it the same way.

**Placeholders**
Saved replies can contain placeholders that are filled in automatically when inserted:
- `{{customer_name}}`, `{{ticket_ref}}`, `{{tracking_number}}`, `{{order_status}}`, `{{my_name}}`
Anything unresolved is left blank rather than showing raw braces.

**Managing the library**
A new "Instant responses" tab on the existing Queues settings page (`/inbox/queues`) lets admins add, edit, reorder, deactivate and delete replies. Each reply has a short title, category, the message body, and a list of trigger keywords/phrases.

## Starter replies (editable afterwards)
Tracking/where is my bike, collection date change, delivery date change, bike damage/claim first response, invoice or payment query, quote request, and a general "we're looking into it" holding reply.

## Technical notes

- New table `public.cs_canned_responses`: `id`, `title`, `category`, `body`, `keywords text[]`, `is_active`, `sort_order`, `created_by`, timestamps. Grants for `authenticated` + `service_role`; RLS so any authenticated staff can read active rows and only admins can write (using the existing `has_role` pattern).
- Seed the starter replies in the same migration.
- New `src/services/cannedResponseService.ts` (list/create/update/delete) and `src/hooks/useCannedResponses.ts`.
- Keyword scanner is client-side in a new `src/lib/cannedMatch.ts`: normalise the last inbound message text, score each response by matched keyword/phrase hits, return the top 3 above a minimum score. No AI call.
- `MessageComposer.tsx` gains the picker (Popover + Command search) and the suggestion chips; insertion runs the placeholder fill using the conversation, its linked order, and the signed-in user's name. Sending logic is unchanged.
- `CustomerServiceQueues.tsx` gains the management tab; no changes to queue/SLA logic.
- Suggestions are hidden for internal notes and when no keywords match.
