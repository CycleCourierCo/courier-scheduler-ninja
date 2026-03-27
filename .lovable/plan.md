

## Fix: SendZen template sending - missing `from` field

### Problem
The edge function logs show: `'from' field is required.` The `send-announcement-whatsapp` function uses `recipient` as the field name and omits the `from` field entirely. The working `send-sendzen-whatsapp` function uses `to` and `from` fields.

### Fix

**`supabase/functions/send-announcement-whatsapp/index.ts`** - update the payload construction:

1. Change `recipient` to `to` in both template and text payloads
2. Add `from: fromNumber` using the same phone number as the working function (`"441217980767"`)

```typescript
// Before (broken):
payload = {
  recipient: normalizedPhone,
  type: "template",
  ...
};

// After (fixed):
const fromNumber = "441217980767";

payload = {
  to: normalizedPhone,
  from: fromNumber,
  type: "template",
  ...
};
```

Same fix applies to the plain text payload branch.

### Technical detail
The SendZen API requires both `to` (recipient) and `from` (sender phone number) fields. The current code was written using `recipient` which is not recognized by the API.

