# AI phone receptionist

An AI voice receptionist that answers your forwarded business number. It can answer questions, look up orders, book deliveries, change the dates a customer has chosen, and send invoices. When it can't help, it transfers the call or creates a support ticket.

## How calls reach it
- Your existing business number forwards calls to a new receptionist number. Forwarding can be always on, or only when a call isn't answered, and you set this with your phone provider.
- The voice runs on ElevenLabs Conversational AI (natural British voice, low delay), connected to a phone number through Twilio or ElevenLabs' own phone numbers.

## What it can do
**Answer questions (no checks needed)**
- How the inspection process works: Inspection only or Inspection and service, fault reporting, customer approval of repairs, and the service choice.
- How Northern Ireland works: our ferry partner, the surcharge per bike, weekday-only delivery, inbound and outbound.
- Pricing, Box My Bike, Foam My Bike, warehouse storage at £40 per month, and delivery timeframes.
- All answers come from one knowledge sheet you can edit, so the receptionist never makes up policies.

**Order actions (only after the caller is confirmed)**
- Check tracking: current stage, driver status, and the latest update.
- Read back the collection and delivery dates the customer chose, and the scheduled timeslot if there is one.
- Change chosen dates, following the same rules as the availability pages: no past dates, weekdays only for Northern Ireland, and business opening hours.
- Book a new delivery: collects sender, receiver, bike details and addresses, reads everything back for confirmation, creates the order, then sends the usual availability emails.
- Send invoices: emails an existing QuickBooks invoice to the email address on the account. It never reads out or changes the email address over the phone.

## Confirming the caller
1. The caller's phone number is matched against the sender or receiver on the order.
2. They are also asked for the postcode of their side of the order, as the tracking page already does.
3. The receptionist only shares details for the side that matched (sender or receiver). Repeated failed attempts are limited and logged.

## When it can't help
- It first transfers the call to a staff number you choose, during opening hours.
- If no one answers, or it's out of hours, it creates a ticket in the Customer Service inbox with the caller's number, a call summary, the transcript, and any linked order.

## Admin
- A new "AI Receptionist" page shows call history, transcripts, the actions taken, and which calls were transferred or turned into tickets.
- Settings: transfer number, opening hours, the knowledge sheet, and on/off switches for each action (booking, date changes, invoices).

## What you'll need to provide
- An ElevenLabs connection, which will be requested during setup.
- A phone number from Twilio or ElevenLabs, and call forwarding set up on your current line (I'll give you steps).
- The staff number for transfers, and your opening hours.

## Technical details
- An ElevenLabs agent with server tools pointing at new secured functions: `receptionist-verify-caller`, `-lookup-order`, `-update-availability`, `-create-order`, `-send-invoice`, `-handoff`. Every request is signed with a shared secret. Order tools require a short-lived verification token returned by the verify step, tied to one order and one side.
- Existing logic is reused where possible: public order lookup and postcode check, availability validation (Europe/London, NI weekday rule), order creation through the existing order service path (so Shipday, emails and geocoding stay the same), and the QuickBooks invoice-send helper.
- New tables `receptionist_calls` and `receptionist_actions` (admin-only read access, service-role write access) and `receptionist_settings`. Tickets go into the existing `cs_conversations` and `cs_messages` with channel `phone`.
- An ElevenLabs post-call webhook saves the transcript and summary.
- Booking over the phone is limited to people calling from a number linked to a known account or contact. Other callers get a ticket or are sent a booking link.
- Rate limiting per caller number, and no personal details or tokens in logs.

## Out of scope for now
- Taking card payments over the phone.
- Outbound calls, such as reminder calls.
