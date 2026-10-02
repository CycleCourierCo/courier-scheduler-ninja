# Unboxed bike collection preparation email

## Goal
Send a separate preparation email alongside the initial booking emails so the person handing over an unboxed bike knows what to do before collection.

## Changes
- Add a branded email titled **“How to prepare your bike for your unboxed bike collection”** using the supplied wording.
- Send it immediately after a new order is created, to the **collection contact only**.
- Keep it as a separate email from the availability request and account-holder booking confirmation.
- Send it only when the booking contains an unboxed bicycle. Exclude clearly boxed or non-bike items such as boxed kids’ bikes, travel bike boxes, wheelsets/framesets, bike racks and turbo trainers.
- For a mixed booking, send one preparation email if at least one item is an unboxed bicycle.
- Include both formatted and plain-text versions, with the normal Cycle Courier Co. sender, branding and reply address.
- Make the send retry-safe so order retries cannot produce duplicate preparation emails.

## Verification
- Check a standard bike booking sends the preparation email to the collection contact.
- Check the account holder does not receive a duplicate unless they are also the collection contact.
- Check boxed/non-bike-only bookings do not send it.
- Check a mixed booking sends it once.
- Confirm the email renders clearly on mobile and the email function deploys successfully.

## Technical details
- Extend the existing order-creation email flow rather than the later status-update workflow, because the guidance is needed at booking time.
- Add an order-level sent timestamp and atomically claim it before sending, following the existing confirmation-email duplicate protection pattern.
- Determine eligibility from the order’s item snapshot so multi-bike bookings are handled consistently.
