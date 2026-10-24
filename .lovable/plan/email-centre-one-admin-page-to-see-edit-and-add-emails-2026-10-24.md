# Email Centre: one admin page to see, edit and add emails

A new admin-only page, **Email Centre**, listing every email the system sends. For each one, admins can change the wording, who gets it, whether it's on, and when it's sent. They can also add brand-new emails. Every change gets a preview and a test send before it goes live.

## What admins see

**List page**
- Every email grouped like the existing email inventory: order journey, Northern Ireland and ferry, Box My Bike, workshop, account, billing, partner, internal, announcements.
- Each row shows the name, when it's sent (for example "When the bike is collected"), who receives it, an on/off switch, and when it was last edited and by whom.
- Search, plus a filter for customer, partner or internal emails.

**Edit page (one email)**
- **Subject and preheader.**
- **Wording:** headline, body paragraphs, button label, and an optional closing note. Tags like `{{tracking_number}}`, `{{sender_name}}`, `{{collection_date}}` and `{{tracking_link}}` are picked from a list, so admins never type raw codes.
- **Who receives it:** sender, buyer, account email, plus extra copies (CC/BCC) to fixed addresses such as staff inboxes.
- **When it's sent:** a dropdown of the moments the system already knows about, such as order created, dates requested, dates confirmed, collection booked, collected, out for delivery, delivered, missed collection or delivery, cancelled, repairs need approval, repairs confirmed, and invoice raised. Where it makes sense there are also delay options: straight away, after X hours, or the next morning in the 8am–8pm London window.
- **On/off switch.**
- **Live preview** using a real recent order, in the branded design, with desktop and phone views.
- **Send test to me** before saving.
- **History:** every saved version, who changed it, and one-click restore. Each email also has a "Reset to original" button.

**Add new email**
- Choose the moment it should be sent and who gets it, then write it the same way as above. It starts switched off until a test send has been done.

## Safety rules
- The fixed safety rules still apply and can't be switched off from this page: test accounts get no emails, no duplicate sends, the receiver-repair gate, the quiet window, and reply-to is always Info@.
- Emails tied to money or the law are locked to "edit wording only", so they can't be switched off or re-timed. These are invoices, account approvals and inspection approval links.
- The approval and availability links (secret order links) are always included and can't be deleted from the wording.
- If an edited email ever fails to build, it falls back to the original wording, so customers never get a blank email.

## Rollout
1. Build the page, versioning and preview/test send. Load every existing email's current wording in as version 1. Customers notice no difference.
2. Switch the senders over to read the saved wording, starting with the order-journey emails, then workshop, Northern Ireland/partner, account, billing and internal.
3. Add the new-email runner, which listens for the chosen moments and sends custom emails.

## Technical notes
- **Tables:**
  - `email_templates` holds the key, category, audience, trigger key, delay, recipients jsonb, cc/bcc, enabled, locked flags, subject, preheader, blocks jsonb, is_custom.
  - `email_template_versions` holds saved snapshots and the editor.
  - Access is admin read/write through `has_role`, with service_role for edge functions. GRANTs are included.
- **Shared `_shared/emailTemplates.ts`:** loads a template by key (cached), renders blocks through `emailShell`/`emailUI`, substitutes an allow-listed variable set with HTML escaping, and returns the hard-coded default on any error.
- **Senders:** `send-email`, `send-order-updates`, the workshop, ferry, account and internal functions call it for the subject, body, recipients and enabled flag. Their existing claim, dedupe and gate logic stays in place.
- **Moments:** a fixed trigger catalogue maps to existing status and stage changes. A new `custom-email-dispatch` function is queued by order status triggers and a 15-minute cron for delayed sends, with a `custom_email_sends` ledger to prevent duplicates.
- **New edge function `email-template-preview`** (admin JWT): renders a preview against a chosen order, or sends a test to the admin's own address.
- **Navigation:** the route is `/admin/email-centre`, added to `ADMIN_MENU_SECTIONS` and the route permissions.
- **Tests:** vitest tests for variable escaping, the locked-email rules and the fallback-on-error behaviour.
