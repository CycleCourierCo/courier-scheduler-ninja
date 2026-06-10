
# Omni-channel Customer Service Inbox (Email + WhatsApp) — Full Plan

A unified inbox in the portal where the customer service team handles **inbound emails** and **WhatsApp messages** as tickets, with auto-linking to the related order, assignment, statuses and internal notes.

---

## 1. Channels in scope (v1)

- **Email** — inbound via Resend's inbound webhook (e.g. `support@notification.cyclecourierco.com`); outbound via existing Resend setup (from `Info@cyclecourierco.com`), with reply threading via `In-Reply-To` / `References` headers so Gmail/Outlook groups it.
- **WhatsApp** — inbound via a new SendZen incoming-message webhook; outbound via existing SendZen edge functions. Free-form replies inside the 24h customer-service window; template picker outside it.

Explicitly **out of scope**: Shopify Inbox, voice/SMS, AI auto-reply, CSAT, marketing/bulk sends, SLA timers, tags, merging an email contact with a WhatsApp contact.

---

## 2. Data model (new tables)

All in `public`, RLS on, with standardised admin/agent policies + `service_role` GRANTs for edge functions.

- **`cs_channel_endpoints`** — inbound addresses/numbers we own (so the webhooks know what's "ours").
  `id, channel, address, label, is_active`

- **`cs_contacts`** — unique per (channel, handle).
  `id, channel ('email'|'whatsapp'), handle, display_name, linked_user_id (→ profiles, nullable)`
  Unique on `(channel, handle)`.

- **`cs_conversations`** — one ticket.
  `id, channel, contact_id, subject, status ('open'|'pending'|'snoozed'|'closed'), assignee_id (nullable), last_message_at, last_message_preview, unread_count, snooze_until, linked_order_id (→ orders, nullable), suggested_order_ids uuid[], auto_link_locked boolean, created_at, updated_at`

- **`cs_messages`** — every message + internal notes.
  `id, conversation_id, direction ('in'|'out'|'note'), author_id (nullable for inbound), body_text, body_html, attachments jsonb, external_id (Resend/SendZen id), email_message_id, in_reply_to, status ('received'|'sent'|'failed'|'delivered'|'read'), error, created_at`

Indexes: `(conversation_id, created_at)`, `(channel, handle)` on contacts, `last_message_at desc` on conversations.

**New role:** add `cs_agent` to the `user_role` enum. Admin + `cs_agent` get inbox access; everyone else denied.

**Storage:** new private bucket `cs-attachments` for email attachments.

---

## 3. Auto-linking the ticket to an order

Runs in both inbound edge functions on every new message (re-run each time in case the customer mentions an order number later):

1. **Token match in subject + body** — regex pull every candidate token and check against `orders.customer_order_number` and `orders.tracking_number`. Exact match → set `linked_order_id` and lock (`auto_link_locked = true`).
2. **Contact match** — query `orders` where any of `sender->>email`, `receiver->>email`, `sender->>phone`, `receiver->>phone` equals the contact handle (phone normalised to E.164).
   - Exactly one match in the last 90 days → auto-link.
   - Multiple matches → store the top 5 (most recent) in `suggested_order_ids`; leave `linked_order_id` null.
3. **Manual override** — agent can search & link any order from the ticket UI; that also sets `auto_link_locked = true` so future inbound messages don't overwrite.

The context panel shows the linked order as a chip (click → order detail) and renders suggestions as one-click "Link" buttons. Linked order powers a quick action: "Insert order tracking link" in the composer.

---

## 4. Inbound flow

### Email — `cs-inbound-email` edge function (`verify_jwt = false`, validates Resend signature)
1. Lookup/create `cs_contact` (channel=email, handle=sender).
2. Thread: if `In-Reply-To` matches an existing `cs_messages.email_message_id`, append to that conversation; else create new conversation with `subject` from the email.
3. Insert `cs_messages` (direction `in`), upload attachments to `cs-attachments`.
4. Run order auto-linker, update `last_message_at` / `unread_count`, set status → `open`.
5. `EdgeRuntime.waitUntil` non-critical work; sanitised logs (no PII).

### WhatsApp — `cs-inbound-whatsapp` edge function (`verify_jwt = false`, validates shared secret)
- Same lookup/insert flow keyed by phone number. Conversation = rolling thread per contact (no header chain). Same auto-linker.

---

## 5. Outbound flow

### `cs-send-message` edge function (`verify_jwt = true`, requires admin or `cs_agent`)
Body: `{ conversation_id, body_text, body_html?, attachments?, template? }`.

- **Email branch** → Resend with `from: Info@cyclecourierco.com`, plus `in_reply_to` and `references` built from the latest inbound `email_message_id` so it threads in the customer's inbox.
- **WhatsApp branch** → SendZen. If last inbound > 24h ago, function returns `template_required`; UI switches to template picker (reuses `list-sendzen-templates`).
- On success: insert outbound `cs_messages` with provider id and status `sent`. On failure: `status='failed'` + error stored and surfaced in the UI.

---

## 6. Portal UI — `/inbox` (and `/inbox/:conversationId`)

Gated to admin + `cs_agent` in `ProtectedRoute.tsx`; nav link only shown to those roles. Three-pane on desktop, stacked on mobile.

**Left — conversation list**
- Filters: All / Mine / Unassigned; channel chips (Email, WhatsApp); status (Open / Pending / Snoozed / Closed); search by name / email / phone / order number.
- Row: channel icon, contact name, preview, time, unread dot, assignee avatar, order chip if linked.

**Middle — thread**
- Chronological inbound/outbound bubbles; internal notes styled yellow; attachment thumbnails.
- Header actions: Assign, Status, Snooze-until, Link to order (searchable), Mark unread.
- Banner when WhatsApp 24h window has expired → forces template flow.

**Right — context panel**
- Contact details (+ linked profile if any).
- **Linked order card** — tracking #, status, sender/receiver names, link to full order detail. "Unlink" button.
- **Suggested orders** list (from `suggested_order_ids`) with one-click "Link".
- Recent orders for this contact (matched on email/phone in `orders.sender`/`receiver`) for manual picking.

**Composer**
- Email: locked subject on replies, rich text, attachments.
- WhatsApp (in-window): free text + emoji.
- WhatsApp (out-of-window): template picker with parameter inputs.
- Toggle "Internal note" → saves as `direction='note'`, never sent.

**Realtime:** Supabase realtime on `cs_messages` and `cs_conversations` so new mail/WhatsApp and other agents' actions appear live. Unread badge in main nav.

---

## 7. Roles & permissions

- Add `cs_agent` to `user_role` enum.
- Admin + `cs_agent`: full read/write on all `cs_*` tables.
- Everyone else: denied (no policy = no access).
- Policies follow the project's `EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid)…)` pattern with `WITH CHECK`.
- Edge functions use `service_role` internally.

---

## 8. External setup the user must do (one-time)

1. **Resend inbound** — configure MX / inbound route on the chosen subdomain pointing to the `cs-inbound-email` URL I'll provide.
2. **SendZen inbound webhook** — point incoming-message webhook at `cs-inbound-whatsapp` URL, with a shared secret I'll add as `SENDZEN_INBOUND_SECRET`.
3. Assign `cs_agent` role to the customer service team members in User Management.

I'll surface the exact webhook URLs and request the one new secret right after you approve.

---

## 9. Build order

1. **Migration:** enum + 4 tables + GRANTs + RLS + storage bucket + indexes.
2. **Edge functions:** `cs-inbound-email`, `cs-inbound-whatsapp`, `cs-send-message` (+ shared `order-linker.ts` helper).
3. **Services + hooks:** `useConversations`, `useMessages`, realtime subscription, order link/search.
4. **`/inbox` UI:** list, thread, composer, context panel with order linking.
5. **Nav + ProtectedRoute:** add `cs_agent` and route allow-list.
6. **End-to-end test:** real inbound email + WhatsApp; auto-link verification; reply both ways; out-of-window template send.

Approve and I'll build it in that order.
