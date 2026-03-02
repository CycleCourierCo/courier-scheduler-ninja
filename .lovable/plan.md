

## Plan: Add Email + Shipday to SendZen Flow & Fix Grouped Timeslot Text

### Problem
The SendZen "Send All" and individual timeslot flows only send WhatsApp via SendZen. They don't update Shipday or send confirmation emails like the 2Chat flow does. Additionally, the grouped timeslot template should format collection/delivery lists as "Collections: bike1, bike2" / "Deliveries: bike1, bike2" — or an empty string if there are none (not "No collections" / "No deliveries").

### Changes

#### 1. Edge Function: `supabase/functions/send-sendzen-whatsapp/index.ts`
- Import Resend
- Accept `relatedJobs` parameter (same as `send-timeslot-whatsapp`)
- After building the SendZen body, run **three background tasks** via `EdgeRuntime.waitUntil()`:
  - **SendZen WhatsApp** (already exists)
  - **Shipday update** — reuse the same logic from `send-timeslot-whatsapp`: fetch Shipday API key, determine pickup/delivery job type, calculate 3-hour window, update each job via `PUT /order/edit/{shipdayId}`
  - **Resend email** — send the same styled HTML email as `send-timeslot-whatsapp`: individual template for single jobs, grouped template for grouped jobs
- All three run in the background; the function still returns immediately with `{ success: true, data: { status: "queued" } }`

#### 2. Client: Grouped timeslot text format
In `RouteBuilder.tsx` (both `sendAllTimeslotsSendZen` and `sendGroupedTimeslotsSendZen`), change:
- `collections.length > 0 ? collections.join(', ') : "No collections"` → `collections.length > 0 ? "Collections: " + collections.join(', ') : ""`
- `deliveries.length > 0 ? deliveries.join(', ') : "No deliveries"` → `deliveries.length > 0 ? "Deliveries: " + deliveries.join(', ') : ""`

Also update the edge function's fallback from `"No collections"` / `"No deliveries"` to just empty string.

#### 3. Client: Pass `relatedJobs` to SendZen calls
In `RouteBuilder.tsx`, for both grouped and standalone SendZen calls, add `relatedJobs` array to the request body so the edge function knows which Shipday jobs to update.

#### 4. `TimeslotSelection.tsx` (individual order page)
No changes needed — the edge function will handle Shipday + email automatically for single-job calls too.

### Technical Detail
- Shipday logic mirrors `send-timeslot-whatsapp`: uses `SHIPDAY_API_KEY`, calculates 3-hour delivery windows with midnight rollover, builds delivery instructions from order data
- Email uses `RESEND_API_KEY` and sends from `Ccc@notification.cyclecourierco.com`
- All external API calls remain in `EdgeRuntime.waitUntil()` to avoid client timeouts
- The `relatedJobs` parameter is optional — if not provided, only the primary order's Shipday job is updated

