# Repair approval: three people to choose from

"Who should approve these repairs?" currently offers two choices. The first one
emails the account that booked the job; the sender contact on the order can't be
picked at all. The chooser becomes three clear options.

## What you'll see

- **Ask the account that booked it** — goes to the account's accounts email (or
  its login email). This is today's first option, renamed so it's obvious.
- **Ask the sender** — new. Goes to the sender's own email on the order.
- **Ask the buyer (receiver)** — unchanged.

Each option shows the email address it will use underneath, and an option is
greyed out with "no email on file" when that address is missing, so nothing fails
after you've clicked.

The same three options appear in the "Who approves?" dropdown next to **Send
approval request**, and the "Approval request sent…" line names which of the
three it went to. Workshop-only inspections are unchanged — they still go
straight to the walk-in customer.

## Technical detail

- `supabase/functions/send-inspection-approval/index.ts`: add `sender` to
  `allowedRecipients`. For it, `to` = `order.sender.email`, greeting name =
  `order.sender.name`, and it uses the same public approval-link email body as
  the receiver/walk-in path (only the booking account approves in-portal).
  Missing address returns a clear 400.
- `src/services/inspectabikeService.ts` (and the release helper it wraps): widen
  the recipient union to `"customer" | "sender" | "receiver" | "walkin"`.
- `src/pages/BicycleInspections.tsx`: widen `approvalRecipients` state and the
  two mutation arg types, add the third `AlertDialogAction` and the third
  `SelectItem`, render each option's address from `order.sender`,
  `order.receiver` and the booking account's profile, disable when empty, and
  extend the "sent to …" wording.
- `bicycle_inspections.approval_recipient` is free text, so no migration is
  needed.

## Still outstanding from the previous plan

The daily greedy route planning work was interrupted part-way: the
`route_plans.mode` column was not added and no code changes were made yet. It
picks back up after this fix.
