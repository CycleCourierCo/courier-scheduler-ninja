# Inbox: scroll inside the chat, not the whole page

## Problem
The message thread already has `overflow-y-auto`, but its parent containers never get a fixed height. The page uses `min-h-screen` / `min-h-[70vh]`, so the middle column simply grows as messages are added and the whole page extends instead of the chat scrolling.

## Fix (frontend only — `src/pages/CustomerServiceInbox.tsx`, `src/components/inbox/MessageThread.tsx`)

1. **Constrain the inbox to the viewport**
   - Change the inbox grid from `flex-1 min-h-[70vh]` to a fixed calculated height: `h-[calc(100dvh-240px)]` (accounts for the site header, page title row and queue tabs; uses `dvh` so mobile browsers size it correctly).
   - Add `min-h-0` to the flex children (outer container, grid, middle thread column, thread scroll area) so flex items are allowed to shrink and the existing `overflow-y-auto` actually engages.

2. **Keep the composer pinned**
   - The reply box stays fixed at the bottom of the middle column; only the message list scrolls. Header (ticket ref, close button) stays fixed at the top.

3. **Auto-scroll to the latest message**
   - In `MessageThread`, scroll to the bottom when the conversation changes or a new message arrives (instant on conversation switch, smooth on new message).

4. **Left list and right panel**
   - Both already use `overflow-y-auto` and will now behave correctly within the capped height — the conversation list scrolls independently instead of stretching the page.

## Result
The inbox page fits the screen: the ticket list, the chat and the contact/order panel each scroll inside their own box, and long threads never push the reply box off-screen.
