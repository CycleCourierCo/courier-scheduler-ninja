# Email Centre: show each email's current content and a live preview

## The problem
Built-in emails are put together in code each time they're sent, so the editor has nothing to show. It opens blank, and you only get a preview once you've written new wording.

## What changes

1. **Keep the latest real copy of every email.**
   - Each time an email goes out, the system saves that copy against the email in the Email Centre: subject, preview line and full design.
   - Only the newest copy is kept, and it overwrites the previous one.
   - Only admins can see it.

2. **The editor opens with the current content.**
   - A preview pane on the right shows the latest copy exactly as the customer saw it, with Desktop and Phone views and the date it was sent.
   - The subject box is filled with the current subject.
   - The headline and paragraph boxes are filled with the current wording, taken from that copy. You edit from there rather than a blank page.
   - Emails that have never been sent since this change say "Not sent yet — the preview will appear after the next one goes out". A "Show the last test order" button fills it straight away where possible.

3. **The preview updates as you type.**
   - **Emails where your wording replaces the original:** the preview shows the new version.
   - **Emails where your wording is added above the original:** the preview shows your text above the real email.
   - **Send test to me:** sends exactly what the preview shows.

4. **Fill every preview straight away.** I'll trigger a one-off sample of each built-in email against a test-account order. These are only built and saved, never sent to customers, so the page is full from day one.

## Privacy
Saved copies contain a real customer's name and address. They're admin-only, only the newest copy is kept, and they're hidden from everyone else. Previews already filled from the test order contain no customer data.

## Technical notes
- Add columns to `email_templates`: `sample_subject`, `sample_html`, `sample_at`.
- Save the copy in `send-email`, after the override and before sending. Save it in the `trackResend` hook for `op.*` keys, and in the 3 direct senders.
- The save is fire-and-forget and never blocks or fails a send.
- Prefill the wording by parsing the sample's `<h1>` and `<p>` text in the browser, skipping the footer and legal block.
- Live preview: a `srcDoc` iframe with `sandbox=""` and a 400ms debounce, using `email-template-preview` (it now accepts `sampleHtml` for intro mode).
- Seed the previews with a `dryRun` flag in `send-email` and the senders, which builds and saves the copy but skips Resend. It's used only by an admin "Refresh previews" action.
