# Inbox ticketing and queues

Turn the customer service inbox into a proper ticketing system: every conversation becomes a numbered ticket with a priority, a reply deadline, and a home queue, and tickets are shared out evenly among the staff who work that queue.

## Queues

- Queues are by team/topic (for example Deliveries, Claims, Accounts, Workshop). You can add, rename, and retire queues from a small settings screen.
- One queue is marked as the default landing place. Every new email starts there.
- Staff choose which queue a ticket belongs in — no keyword rules. Moving a ticket is one dropdown in the ticket header.
- Each queue has a member list (the staff who work it) plus a target reply time per priority.

## Tickets

- Every conversation gets a permanent reference like `TCK-1042`, shown in the list, the ticket header, and quoted in outgoing email subjects so customer replies stay on the same ticket.
- Priority: low, normal, high, urgent. Normal by default, changeable at any time.
- Reply deadline: worked out from the queue's target time for that priority, counted from the customer's latest unanswered message. Replying clears it; a new customer message sets a fresh one.
- The list shows a clear "due in 2h" / "overdue 40m" marker and can be sorted by deadline, so the most urgent work is obvious.
- Existing status (open, pending, snoozed, closed) stays as-is and keeps working.

## Assignment

- When a ticket arrives in a queue with no owner, it is handed to the next member in turn (round-robin), skipping anyone currently marked unavailable.
- Moving a ticket to a different queue re-assigns it to that queue's next member, unless someone deliberately assigned it to a named person.
- Staff can still reassign or take a ticket manually, and "unassign" puts it back in the pool for the next round-robin pass.
- Round-robin only applies to new/unowned tickets — it never pulls a ticket away from someone already working it.

## What staff will see

- Left panel gains a queue selector above the existing filters, with unread and overdue counts per queue.
- Ticket rows show reference, priority colour, deadline marker, queue, and owner.
- Ticket header gains queue, priority, and assignee controls next to the existing status control.
- A small "Queues" settings page for admins: queues, members, and target reply times.
- All of this stays inside the existing inbox layout and is restricted to admins and customer service agents, exactly as the inbox is today.

## Technical notes

- New tables: `cs_queues` (name, slug, is_default, active, sort order), `cs_queue_members` (queue, user, active, round-robin cursor support), `cs_queue_slas` (queue + priority + target minutes).
- `cs_conversations` gains `ticket_ref` (unique, backed by a counter table and trigger, same pattern as `claims.set_claim_ref`), `queue_id`, `priority` (new enum), `first_response_due_at`, `next_response_due_at`, `assigned_manually` (boolean so round-robin respects deliberate assignments).
- Grants and RLS mirror the current `cs_*` policies: `admin` or `cs_agent` full access, `service_role` for edge functions; `authenticated` grants only, no `anon`.
- Deadline recalculation and round-robin assignment live in a `SECURITY DEFINER` function called from the shared inbound path (`supabase/functions/_shared/cs-inbound.ts`) and from `cs-send-message`, so both webhook and 5-minute sync routes behave identically. Round-robin uses a per-queue cursor updated in the same statement that assigns, so parallel inbound emails cannot pick the same member twice.
- Backfill migration: create default queues, assign every existing conversation to the default queue, mint references for existing rows, and set normal priority.
- Frontend: extend `customerServiceInboxService.ts` and `useConversations`, add queue/priority/deadline UI to `ConversationList`, `ConversationHeader`, and the filter panel; add a `CustomerServiceQueues` settings page and route.
- Deadlines display in Europe/London and the marker is computed client-side from `next_response_due_at`, so no polling job is needed.
