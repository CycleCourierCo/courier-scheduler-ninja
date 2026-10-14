# Stop emails going to alper@pedaluk.com

## What I found
The account's login email was changed to info@trybeforeyoubike.com, but the old address is still saved in four other places:
- **Accounts email** on the profile is still alper@pedaluk.com, so invoices and account emails still go there.
- **Address book**: 1 saved contact still uses alper@pedaluk.com.
- **Open jobs**: 3 jobs list him as the sender and 1 as the receiver. Each job keeps its own copy of the contact details, so collection, delivery and dates emails for those jobs still go to the old address.

## The fix
1. Change the accounts email on the profile to info@trybeforeyoubike.com.
2. Change the saved address book contact to the new address.
3. Change the sender/receiver email on the 4 open jobs (only jobs that aren't delivered or cancelled). Finished jobs stay as they are.

This is a one-off data fix. No change to how the app works.

## Optional
When an admin changes a user's login email, show a warning if the accounts email or saved contacts still use the old address, and offer to update them too. Say if you want this added.
