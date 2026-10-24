# Fill every Email Centre template with its current wording

## Goal
Opening any email in the Email Centre shows the real current subject, wording and a preview right away, without waiting for that email to be sent again.

## What will happen
1. **Use past emails where they exist.** For each email type, find the most recent copy already sent (from the email send history) and save it as that template's current sample.
2. **Generate the rest.** For emails never sent (or not in history), build the email using the app's own built-in wording with a realistic example order (made-up names like "Jane Smith", a sample tracking number), and save that as the sample. These are marked "Example data" in the preview so staff know it is not a real customer.
3. **Prefill the editor.** Each template's editable headline, paragraphs and subject are filled from that sample, so "Start from current wording" is no longer needed to begin editing. Nothing is published or changed in what customers receive — the built-in emails keep sending until an admin saves an edit.
4. **Keep it current.** Real sends continue to overwrite the sample, as now.

## Checks
- Count of templates with a preview before and after (target: all ~50).
- Open a few templates in the Email Centre (desktop and phone) to confirm wording and preview appear.
- Confirm no customer received an email during the fill.

## Technical details
- One-off admin-only edge function `email-template-backfill` that: reads latest matching rows from the Resend send log per template key; otherwise calls each sender's HTML builder with a fixture payload in a dry-run mode (no Resend call); writes `sample_subject/sample_html/sample_at` plus a `sample_is_example` flag (new column) to `email_templates`.
- Prefilled editable fields stored as draft values only; `wording_mode` stays at built-in until an admin publishes.
- Real-customer samples stay admin-only as today.
