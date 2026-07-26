
## Goal
Add a **Bulk Message Customers** action inside the Get-Timeslots popup on the Route Builder, alongside the existing Flip Route / Send All (SendZen) controls, so admins can broadcast a custom SendZen WhatsApp message and/or email to the customers of the jobs currently in the popup — for delay/cancellation notifications.

## Placement
- Inside `MultiJobTimeslotDialog` (the Get-Timeslots popup), next to the **Flip Route** button.
- Button label: **Bulk Message** (MessageSquare icon), variant `outline`.
- Enabled whenever the popup has at least one job.

## New component
`src/components/scheduling/BulkRouteMessageDialog.tsx` — nested modal opened from the timeslot popup.

### Recipient list
- One row per job in the popup (pickup and delivery rows shown separately), each with a checkbox.
- **Pre-tick rule — only "active" jobs are ticked by default.** A job is treated as completed (unchecked, greyed out, small badge showing reason) when any of:
  - `job.type === 'delivery'` and the order's `order_delivered === true`
  - `job.type === 'pickup'` and the order's `order_collected === true`
  - the order's Box My Bike status is `delivered_by_3p`
- Completed jobs remain visible; the admin can re-tick them.
- "Select all active" / "Select none" quick actions.
- Send-time dedupe: after the user's ticks, dedupe by phone (WhatsApp) and by email (Email) independently so a customer with pickup + delivery doesn't get two identical messages. Header shows the count of unique WhatsApp and unique Email recipients.

### Channels
- Two toggles: **Send WhatsApp** and **Send Email** (either or both; at least one required to send).

### WhatsApp composer
Tabs Plain Text / Template, mirroring `AnnouncementEmailsPage.tsx`:
- Plain text: textarea with 4096-char limit.
- Template: dropdown fed by `list-sendzen-templates`; per-parameter inputs.
- Shared helpers extracted into `src/lib/sendzenTemplates.ts`, reused by both this dialog and the announcements page (no behaviour change to the page).

### Email composer
Subject + body (plain text). Server-side branded wrapper applied by `send-email`, matching the announcements page payload shape.

### Sending
- Reuse existing edge functions — no new ones:
  - WhatsApp → `send-announcement-whatsapp` (already supports plain-text and template modes).
  - Email → `send-email`.
- Sequential loop with a small throttle to avoid SendZen rate limits.
- Skip recipients without a phone (WhatsApp) or without an email (Email); count as "skipped".
- Progress bars per channel; toast summary on completion: `WhatsApp: X sent / Y failed / Z skipped · Email: X sent / Y failed / Z skipped`.
- Per-recipient errors logged to console; dialog stays open on partial failure so admin can retry.

## Data source
Uses the jobs already passed into `MultiJobTimeslotDialog`. `order_collected`, `order_delivered`, and Box My Bike status come from the same order snapshot the popup already has; missing field ⇒ treat as not completed.

## Non-goals
- No schema changes; no persisted message history.
- No changes to the Flip Route or Send All (SendZen) behaviour.
- No new edge functions.
- No changes to the customer tracking page.

## Files touched
- `src/components/scheduling/MultiJobTimeslotDialog.tsx` — add "Bulk Message" button next to Flip Route; wire dialog open/close.
- `src/components/scheduling/BulkRouteMessageDialog.tsx` — new.
- `src/lib/sendzenTemplates.ts` — new (extracted template helpers).
- `src/pages/AnnouncementEmailsPage.tsx` — refactor to import shared helpers (behaviour unchanged).
