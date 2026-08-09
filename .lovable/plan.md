# Show a proper sender name on emails

Right now most emails are sent with only the raw address `Ccc@notification.cyclecourierco.com` and no display name, so Gmail falls back to showing "Ccc". Adding a display name fixes it — the inbox will show **CCC - Cycle Courier Co.** instead.

## What changes

Set the sender to `CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>` in every place emails are sent:

- Customer emails (availability, scheduling, confirmations, tracking) — `send-email`
- Timeslot and loading-list notification emails
- Order/API confirmation emails
- Route reports, timeslip emails, and the new internal reports (these already have a name; they get aligned to the same wording)

Reply-to stays `Info@cyclecourierco.com`, and the sending address itself is unchanged, so deliverability and DNS setup are unaffected.

One exception: the customer-service inbox function sends from `Info@notification.cyclecourierco.com` as "The Cycle Courier Co." — it will be aligned to "CCC - Cycle Courier Co." too, keeping its own address.

## Technical notes

Files updated (Resend `from` field only):
`send-email`, `send-timeslot-whatsapp`, `send-loading-list-whatsapp`, `send-sendzen-whatsapp`, `orders`, `generate-timeslips`, `send-route-report`, `send-internal-reports`, `cs-send-message`.

Affected edge functions are redeployed afterwards. Note the display name only applies to new emails — existing ones in the inbox still show "Ccc".
