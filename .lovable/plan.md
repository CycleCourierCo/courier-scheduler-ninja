# Inspection-only and service choices

## What will change
- Give customers two booking choices: **Inspection only** and **Inspection and service**. Keep the existing inspection-and-service choice available, and let staff choose either option when enabling an inspection on an order.
- Save the selected choice with the order and inspection so it survives refreshes and can be identified later. Existing inspection bookings will remain **Inspection and service** unless explicitly changed.
- Show an **Inspection only** or **Inspection and service** badge on each bike on the Bicycle Inspections page, including completed bikes. Keep the existing progress/status badge separate.
- After a mechanic completes an inspection, preserve the existing individual repair approval choices. For inspection-only bookings, also show a **Service** card by default alongside the repairs for the customer to accept or decline; it is not silently authorised. For inspection-and-service bookings, clearly show that service was already chosen, without asking the customer to buy it twice.
- Ensure the customer's service decision is saved and carried through the existing workshop completion and invoicing flow, so a declined service is not performed or charged and an accepted service is not lost.

## Technical approach
- Add a constrained inspection choice to persisted booking/inspection data, with safe defaults for legacy records; update the order creation, staff enablement, inspection creation, and display paths together.
- Extend the public repair-approval payload and submission to include a server-validated, idempotent service decision and its configured price. Prevent callers from changing the service decision for another inspection or bypassing approval by editing the browser response.
- Make the workshop service tasks and billing respect the selected choice and customer decision while leaving fault reporting and optional individual repairs available to both booking types.
- Verify both choices through booking, inspection completion, customer approval, badges, and billing on desktop and mobile; retain the current inspection/repair safeguards.
