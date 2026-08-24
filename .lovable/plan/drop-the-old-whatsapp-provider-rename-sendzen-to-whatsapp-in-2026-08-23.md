# Drop the old WhatsApp provider, rename SendZen to WhatsApp in the UI

Two WhatsApp providers exist today. SendZen powers announcements, grouped timeslots, loading lists, repair offers, and the customer service inbox. An older provider (2Chat) still powers two things: the legacy timeslot sender and the driver timeslip message. Everything 2Chat is being removed, and the front end will stop saying "SendZen" and just say "WhatsApp".

## 1. Remove the old-provider timeslot sender

- Delete the legacy timeslot edge function (`send-timeslot-whatsapp`) and its config entry, and remove the deployed function.
- Remove the buttons and handlers that call it:
  - Order detail timeslot panel: remove the legacy "Send Timeslot" action, keeping only the WhatsApp (SendZen-backed) one.
  - Route builder: remove the single-job and per-stop legacy send handlers and their buttons.
  - Multi-job timeslot dialog: remove the legacy send path.
- Remove now-unused state, loading flags, and result-toast handling for those actions.

## 2. Remove the driver timeslip WhatsApp

- Delete the `send-timeslip-whatsapp` edge function, its config entry, and the deployed function.
- Remove the route builder's "send timeslip to driver" button, handler, and message-building code.

## 3. Rename SendZen to WhatsApp on the front end

Across `TimeslotSelection.tsx`, `ContactDetails.tsx`, `AdminContactEditor.tsx`, `RouteBuilder.tsx`, `BulkRouteMessageDialog.tsx`, and `AnnouncementEmailsPage.tsx`:

- Button labels, toasts, headings, and tooltips: "Send via SendZen" becomes "Send WhatsApp", "SendZen failed" becomes "WhatsApp failed", and so on.
- Local identifiers: `handleSendViaSendZen` becomes `handleSendWhatsApp`, `isSendingSendZen` becomes `isSendingWhatsApp`, `sendzenType` becomes `messageType`, etc.
- Backend function names (`send-sendzen-whatsapp`, `list-sendzen-templates`) stay unchanged so nothing breaks — only the user-facing wording and front-end variable names change. Renaming the functions themselves can be a separate follow-up if wanted.

## 4. Verification

- Typecheck and search for leftover references to the deleted functions and the removed provider's environment variables.
- Confirm the remaining WhatsApp sends still compile and the route builder / order detail pages render without the removed buttons.

## Technical notes

- The old provider's secrets (`TWOCHAT_API_KEY`, `TWOCHAT_FROM_NUMBER`) become unused; they can be deleted from project secrets on request.
- The SendZen sender already replicates the legacy function's Shipday update and email fallback, so removing the legacy path loses no delivery-side behaviour.
