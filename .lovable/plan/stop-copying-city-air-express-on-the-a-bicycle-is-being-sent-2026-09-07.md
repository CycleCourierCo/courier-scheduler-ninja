# Stop copying City Air Express on the "a bicycle is being sent to you" email

Right now, when a Northern Ireland order is created, the ferry partner is copied in on the customer's "A bicycle is being sent to you" email — on top of their own booking email, which already carries the direction, the NI-side address and the upload link. That copy is redundant.

## Change

- Remove City Air Express from the recipients of the "A bicycle is being sent to you" email.
- Everything else stays as it is: the booking email at order creation, manual resends, and the outbound delivery-date emails that go to them instead of the NI receiver.
- The Box My Bike end buyer keeps receiving this email as before.

## Technical notes

- `src/services/emailService.ts`: in `buildReceiverRecipients`, drop the `CITY_AIR_EXPRESS.email` push (the `isNI` argument becomes unused and can go). The Northern Ireland details block inside that email body is left untouched, since it's the only place using the helper and the block is still useful to the customer's own record.
- No edge function or database changes.
