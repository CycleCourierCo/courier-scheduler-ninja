# Inspection-only and inspection-and-service

## Customer booking
- Replace the single **Inspect and Service** switch with two explicit choices: **Inspection only** and **Inspection and service**.
- Save the selected choice on the order and copy it to the workshop inspection record.
- Keep existing inspections as **Inspection and service** so historic jobs do not change behaviour.

## Staff workflow
- Add separate **Inspection only** and **Inspection and service** actions when staff enable workshop work on an order.
- Show the selected type as a clear badge on every Bicycle Inspections card.
- Keep the normal checklist and fault-recording flow for both types.
- Only show cleaning/service tasks after service is included in the booking or accepted later by the customer.
- Prevent an inspection-only bike from advancing through service/completion stages while the customer's service choice is pending.

## Customer approval
- For an inspection-only booking, show a separate **Service** choice beside any individual repair recommendations after the mechanic releases the report.
- Let the customer accept or decline service independently from the listed repairs, including when no faults were found.
- Show the service price from the existing QuickBooks **Bike Inspection & Service** product; the browser will not supply or control that price.
- Record the service decision once and include it in the confirmation shown to the customer.

## Billing and completion
- Add the existing QuickBooks service line only when service was booked initially or later accepted.
- Block the retrospective service invoice when service was declined or is still awaiting a decision.
- Ensure accepted service participates in workshop completion even when no individual repairs were approved.
- Ensure declined service does not require cleaning/service steps or get billed accidentally.

## Validation
- Check booking, staff enablement, inspection badges, customer approval with and without faults, completion, and both invoice paths.
- Verify phone and desktop layouts, type checks, current build output, and focused edge-function tests.

## Technical details
- The database now has constrained `inspection_type` and `service_decision` fields and copies the order choice into new inspections.
- Extend the existing public approval flow through a validated server-side handler, preserving the current link-based access while avoiding a new publicly executable privileged database function.
- Instrument new request failures with Sentry exception capture and meaningful spans; do not log customer data.
