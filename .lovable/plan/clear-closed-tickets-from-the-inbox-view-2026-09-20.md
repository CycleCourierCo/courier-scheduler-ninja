# Clear closed tickets from the inbox view

## What changes

1. **Closing a ticket clears the screen.** When you close a ticket (from the "Close ticket" button or by setting its status to closed), the middle conversation area and the right-hand contact/linked order/task panel both empty out, showing "Select a conversation to view messages." The ticket also disappears from the left list while the list is filtered to open/pending, because it no longer matches.

2. **New dismiss button.** A small X button in the ticket header clears the currently open ticket from view (middle and right panels) without changing the ticket itself. Nothing is closed or edited — it just deselects.

3. **No auto-reselect after clearing.** Today the inbox automatically jumps to the first ticket in the list when nothing is selected. After closing or dismissing, it stays empty until you pick a ticket yourself; auto-select still works on a fresh page load.

## Technical notes

- `src/pages/CustomerServiceInbox.tsx`: add a `clearSelection` handler that navigates to `/inbox` and sets a flag suppressing the auto-select effect until the user clicks a row in `ConversationList`. Pass the handler into `ConversationHeader`.
- `src/components/inbox/ConversationHeader.tsx`: accept an optional `onDismiss`/`onClosed` prop; call it after a successful `closeTicket` and after a status change to `closed`; render an X icon button (`aria-label="Clear ticket from view"`) at the right of the header row.
- Middle/right panels already render conditionally on `conversation`, so clearing the route id empties both.
- No database, edge function, or permission changes.
