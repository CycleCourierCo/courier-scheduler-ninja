# PedalUK Data Processing Agreement: where we stand

Short answer: **No.** The app's privacy policy is short and general, and it doesn't cover what this agreement asks for. The way the platform handles data also doesn't match several clauses yet. This is not legal advice. Have a solicitor check it before you sign.

## Main gaps

1. **Deleting data after 30 days (clause 7.1).** Orders, contact details, proof-of-delivery photos and messages are kept with no time limit. The agreement says job data must be deleted 30 days after the job is done, and proof of delivery after 12 months.
2. **Outside services, list and notice (clause 5).** Customer data goes to Shipday, SendZen (WhatsApp), Resend (email), QuickBooks, Google Maps, Supabase hosting, Sentry, PostHog and Google Gemini (AI route planning). PedalUK needs a written list of these, 14 days' notice before any new one is added, and a data contract with each.
3. **Data leaving the UK (clause 4.7).** Several of those services are US-based or may store data outside the UK. That needs PedalUK's written consent first.
4. **No use for our own purposes (clause 3.3).** PedalUK customers must not get announcements or review requests, must not be added to the address book as our own contacts, and must not be counted in analytics. At the moment these features treat every customer the same way.
5. **Data not allowed (Schedule 1).** We must never collect bank or card details or ID from PedalUK customers. The "payment collection" fields on orders must not be used for PedalUK jobs.
6. **Requests and breaches (clause 6).** We need a written process: send customer data requests on to PedalUK within 2 working days, and report any breach to info@pedaluk.com within 24 hours.
7. **Privacy policy page.** It doesn't say we act as a processor for business clients, doesn't list the outside services or how long we keep data, and is dated April 2025.

## Proposed app changes (if you want them)

- Mark the PedalUK account as a "data processor client". For its jobs:
  - no announcements, review requests or analytics tracking
  - no address-book saving
  - payment fields blocked
- A nightly clean-up for that account: remove names, phones, emails and notes 30 days after delivery, and remove photos and signatures after 12 months. Tracking numbers, bike details and invoice amounts stay.
- An admin record of data requests and breaches, with the due dates shown.
- Update the privacy policy page with a processor section, the list of outside services, how long data is kept, and a new date.

## Outside the app (for you)

- Data agreements with each outside service, plus PedalUK's consent for data leaving the UK.
- Staff training, phone passcodes, and shredding printed labels.
- Signing the agreement.

## Technical details

- New `profiles.is_data_processor_client` flag. It is checked in the announcement, review and PostHog paths, in contact upserts, and in payment-field validation.
- A cron job (SECURITY DEFINER wrapper pattern) clears the personal-data fields in the `sender`/`receiver` JSONB and deletes storage objects for flagged accounts.
- A `dpa_incidents` table that only admins can access, with RLS and grants.
