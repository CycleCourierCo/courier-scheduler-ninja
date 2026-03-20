

## Fix: Dates Shifted by 1 Day in Confirmation Emails

### Root Cause

The customer selected dates like **April 9** in their browser (BST, UTC+1). The code stores them via `date.toISOString()`, which converts midnight BST to `2026-04-08T23:00:00.000Z` (23:00 UTC on the **previous day**). The edge function then formats this UTC timestamp with `new Date(dateStr).toLocaleDateString('en-GB', ...)` — which renders **April 8** (Wednesday) instead of April 9 (Thursday).

This is why the email shows "Wednesday 8 April" instead of "Thursday 9 April", and "Friday 10 April" instead of "Saturday 11 April", etc. Every date is shifted back by one day, and some land on Fridays as a result.

### The Fix — Two Parts

**1. Edge function date formatting (immediate fix for emails)**

In `supabase/functions/send-email/index.ts`, change the date formatting to parse dates as UTC dates (ignoring timezone shift). Replace `new Date(dateStr)` with a UTC-aware approach that extracts the intended calendar date:

```typescript
const date = new Date(dateStr);
// Use UTC methods to avoid timezone shift
const formatted = date.toLocaleDateString('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  timeZone: 'Europe/London'  // Format in UK timezone
});
```

Adding `timeZone: 'Europe/London'` ensures the date renders correctly for UK customers regardless of the server's timezone.

Apply this to both `sender_dates_confirmed` and `receiver_dates_confirmed` email sections.

**2. Service-side date storage (prevent future issues)**

In `src/services/availabilityService.ts`, change `updateSenderAvailability` and `updateReceiverAvailability` to store dates as date-only strings (`YYYY-MM-DD`) instead of full ISO timestamps. This avoids timezone ambiguity entirely:

```typescript
const dateStrings = dates.map(date => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
});
```

Also add **server-side Friday/holiday filtering** (from the previously approved but not yet implemented plan) to strip invalid dates before saving.

### Changes

| File | Change |
|---|---|
| `supabase/functions/send-email/index.ts` | Add `timeZone: 'Europe/London'` to both date formatting calls (sender and receiver confirmed emails). |
| `src/services/availabilityService.ts` | Store dates as `YYYY-MM-DD` strings instead of `.toISOString()`. Add Friday + holiday filtering before save. |
| `src/hooks/useAvailability.tsx` | Add pre-submit filtering of Fridays/holidays with toast feedback. |

### Deployment

Redeploy `send-email` edge function after changes.

