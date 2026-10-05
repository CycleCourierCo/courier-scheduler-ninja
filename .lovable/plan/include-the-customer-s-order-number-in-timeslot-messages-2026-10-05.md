# Include the customer's order number in timeslot messages

When a job has a customer order number, show it in every timeslot WhatsApp and email: single sends from the order page, single sends from Get Timeslots, and "send all" / combined messages. Jobs without one look exactly as they do today.

## What the customer will see

- Single job (WhatsApp): "Your Trek Domane (Order #: 12345) delivery has been scheduled…"
- Single job (email): an "Order #: 12345" line under the bike name, and the number in the subject line.
- Combined stop (WhatsApp and email): each bike in the list gets its number, e.g. "Deliveries: Trek Domane (Order #: 12345), Specialized Tarmac (Order #: 67890)".

## Technical details

- The WhatsApp templates are pre-approved with fixed fields, so no new field is added. The number goes into fields that already exist:
  - Single templates: added to the end of the `bike_model` value in `send-sendzen-whatsapp`.
  - Grouped template: added per bike in the job lists.
- `send-sendzen-whatsapp/index.ts`: individual WhatsApp body and `sendEmail` individual branch (line and subject) read `order.customer_order_number`.
- `RouteBuilder.tsx` (both grouped senders, around lines 3112 and 3220): append `(Order #: X)` to each `describeBikes(job.orderData)` entry when `orderData.customer_order_number` is set. The order page and individual Get Timeslots sends already use the same function, so they are covered by the backend change.
- Redeploy `send-sendzen-whatsapp`.
