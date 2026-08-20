# Fix the error when sending/re-sending a repair offer to the receiver

Sending or re-sending the "Offer these repairs to the receiver" message currently fails every time with a generic failure.

## Cause (confirmed)

The edge function logs show:

```text
send-repair-offer error: column orders.is_test_account does not exist
```

The function reads `is_test_account` from the `orders` table, but that column lives on `profiles` (the booking account), not on `orders`. The query throws, so the whole request returns a 500 and nothing is sent.

## Fix

In `supabase/functions/send-repair-offer/index.ts`:

- Select `user_id` from `orders` instead of `is_test_account`.
- Look up the booking account's `is_test_account` from `profiles` by that `user_id` (matching how other functions do test-account suppression).
- Keep the existing behaviour: for test accounts, stamp the offer and return `skipped: "test_account"` without emailing or WhatsApping.

No database changes and no UI changes needed. After the fix, offering and re-sending will send the receiver the email and WhatsApp with the `/repair-offer/<order id>` link as designed.
