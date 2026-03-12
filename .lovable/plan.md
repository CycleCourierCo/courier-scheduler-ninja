

## Auto-Send Receiver Availability Email on Collection (When No Dates Set)

### Problem
When a bike is collected, the system sends collection confirmation emails but doesn't check whether the receiver has already set their availability dates. If the sender never set dates (so the normal flow that triggers receiver availability was skipped), the receiver never gets a chance to choose delivery dates.

### Solution
In the `handleCollectionConfirmation` function in `supabase/functions/send-email/index.ts`, after sending the collection confirmation emails, check if the receiver has set availability dates (`delivery_date` field on the order). If `delivery_date` is null/empty, automatically send the receiver availability email instead of (or in addition to) the standard "bike collected" notification to the receiver.

### Changes

**`supabase/functions/send-email/index.ts`** — in `handleCollectionConfirmation()`:

After the existing collection confirmation logic (around line 695), add:

1. Check if `order.delivery_date` is null or empty (receiver hasn't set availability)
2. If no dates set, invoke the receiver availability email by calling the same `send-email` function internally with `emailType: "receiver"` — or more simply, construct and send the receiver availability email directly using Resend within the same function
3. Log whether the receiver availability email was triggered

The receiver will get **both** the "bike collected" notification (so they know it's in transit) **and** the availability selection email (so they can pick dates). This covers the case where the sender skipped setting dates.

### Implementation Detail

```typescript
// After collection confirmation emails are sent (line ~706)
// Check if receiver needs to set availability dates
if (!order.delivery_date || (Array.isArray(order.delivery_date) && order.delivery_date.length === 0)) {
  console.log("Receiver has no availability dates set, sending receiver availability email");
  
  const availabilityUrl = `https://booking.cyclecourierco.com/receiver-availability/${orderId}`;
  const availabilityHtml = `...`; // Receiver availability email template
  
  await resend.emails.send({
    from: "Ccc@notification.cyclecourierco.com",
    to: order.receiver.email,
    subject: `Choose Your Delivery Dates - ${order.tracking_number}`,
    html: availabilityHtml,
    reply_to: "Info@cyclecourierco.com"
  });
}
```

I need to check the existing receiver availability email template to replicate it correctly in the edge function. Let me look at how `emailType: "receiver"` is handled in the same edge function to reuse that template.

### Files Modified
- `supabase/functions/send-email/index.ts` — Add receiver availability check + email send inside `handleCollectionConfirmation()`

