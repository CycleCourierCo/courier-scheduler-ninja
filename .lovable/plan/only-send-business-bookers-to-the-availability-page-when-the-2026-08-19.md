# Only send business bookers to the availability page when they are the sender

## What changes

After a business account creates an order, they currently always land on the sender availability page. That only makes sense when the business is the one sending the bike.

New behaviour:
- Business account is the **sender** on the order -> redirect to `/sender-availability/<order id>` with the existing "set your collection availability now" toast (unchanged).
- Business account is the **receiver** (or neither) -> go to the dashboard as before. They get the normal receiver availability email once the sender has confirmed their dates.

## How "are they the sender?" is decided

Compare the sender email entered on the order form against the logged-in profile's email and accounts email (case-insensitive, trimmed). If either matches, they are the sender.

## Technical notes

- `src/pages/CreateOrder.tsx`: in the post-create branch, keep the `isBusinessAccount` check but add a sender-match check using the submitted `data.senderEmail` vs `userProfile.email` / `userProfile.accounts_email` before navigating to sender availability; otherwise `navigate('/dashboard')`.
- No changes to emails, saving, or the availability pages themselves.
