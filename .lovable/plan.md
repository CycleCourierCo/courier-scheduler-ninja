

## Fix: SendZen `lang_code` field

### Problem
The SendZen API error says: `'lang_code' in the template object is required.`

Our current code uses `language: { code: "en_GB" }` (WhatsApp Cloud API format), but SendZen expects `lang_code: "en_GB"` as a flat string field inside the `template` object.

### Change: `supabase/functions/send-sendzen-whatsapp/index.ts`

Replace all 3 occurrences of:
```typescript
language: { code: "en_GB" },
```
with:
```typescript
lang_code: "en_GB",
```

Lines affected: inside `collection_timeslots`/`delivery_timeslot` block, `grouped_timeslot` block, and `review` block. Then redeploy.

