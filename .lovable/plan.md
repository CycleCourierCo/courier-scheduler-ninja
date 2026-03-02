

## SendZen WhatsApp Integration

### Overview
Create a new edge function and add duplicate SendZen buttons across the app for: individual timeslots, grouped timeslots (with separate `collection_job_list` / `delivery_job_list`), bulk "Send All", and review messages. No 4-minute delay for SendZen.

### 1. Store Secret
Store `SENDZEN_API_KEY` = `sz_live_9f5ddb4e-9258-4126-89d5-6047d200dc84` as a Supabase secret.

### 2. Create Edge Function: `supabase/functions/send-sendzen-whatsapp/index.ts`

Handles 4 template types via `POST https://api.sendzen.io/v1/messages`:

- **`collection_timeslots`** — sender timeslot (params: `contact_name`, `bike_brand`, `bike_model`, `date`, `start_time`, `end_time`, button URL = tracking number)
- **`delivery_timeslot`** — receiver timeslot (same params + button)
- **`grouped_timeslot`** — grouped location (params: `contact_name`, `date`, `start_time`, `end_time`, `collection_job_list`, `delivery_job_list`). If no collections: "No collections". If no deliveries: "No deliveries".
- **`review`** — review request (param: `customer_name`)

All use `from: "441217980767"`, `lang_code: "en_GB"`, Bearer auth.

The function:
- Fetches the order from DB to get contact info, bike details, tracking number, scheduled date
- Calculates 3-hour window (end_time = start_time + 3h, clamped at 23:00)
- Formats date as "Wednesday 25 February 2026"
- Does NOT update order status or Shipday (the calling code handles that)

Request body accepts:
```json
{
  "orderId": "...",
  "type": "collection_timeslots" | "delivery_timeslot" | "grouped_timeslot" | "review",
  "recipientType": "sender" | "receiver",
  "deliveryTime": "HH:MM",
  "collectionJobList": "Trek Emonda, Scott Addict",
  "deliveryJobList": "No deliveries"
}
```

### 3. Update `supabase/config.toml`
Add `[functions.send-sendzen-whatsapp]` with `verify_jwt = false`.

### 4. UI: TimeslotSelection.tsx
Add a "Send via SendZen" button below the existing "Send Timeslot" button. Same DB update + status logic, then calls `send-sendzen-whatsapp` with `collection_timeslots` (sender) or `delivery_timeslot` (receiver).

### 5. UI: AdminContactEditor.tsx
Add a "Send Review" button (MessageSquare icon) in the header area next to the edit button. Calls `send-sendzen-whatsapp` with `type: "review"`. Only shown when contact has a phone number.

### 6. UI: ContactDetails.tsx
Add a "Send Review" button. Requires new `orderId` prop.

### 7. UI: RouteBuilder.tsx — "Send All (SendZen)" Button
Duplicate `sendAllTimeslots` as `sendAllTimeslotsSendZen`:
- Same grouping logic (750m radius)
- For grouped locations: calls edge function with `type: "grouped_timeslot"`, passing `collectionJobList` and `deliveryJobList` strings (e.g. "Trek Emonda, Scott Addict" or "No collections")
- For standalone jobs: calls with `collection_timeslots` or `delivery_timeslot`
- **No 4-minute delay** between messages
- Same DB updates (timeslot, date, status) as existing
- Same route report at the end
- Add button in both drawer and dialog views next to existing "Send All Timeslots"

### 8. UI: RouteBuilder.tsx — Per-card "Send via SendZen" for Grouped Locations
Duplicate `sendGroupedTimeslots` as `sendGroupedTimeslotsSendZen` using the `grouped_timeslot` template with the same `collectionJobList`/`deliveryJobList` format.

