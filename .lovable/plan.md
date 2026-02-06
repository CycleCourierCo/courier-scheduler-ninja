
# Fix Contact Creation & Linking for Shopify Orders

## Problem Confirmed

All Shopify orders have `sender_contact_id` and `receiver_contact_id` as NULL:

| Order ID | Created At | sender_contact_id | receiver_contact_id |
|----------|------------|-------------------|---------------------|
| 01152b24-4290-4300-ae2d-f0da09e8c2b7 | 2026-02-06 22:43 | NULL | NULL |
| 44433355-9a0a-4271-8608-98bb2c413d5e | 2026-02-06 19:57 | NULL | NULL |
| c3cb316d-96eb-421c-8e12-b5352b71197d | 2026-02-06 15:19 | NULL | NULL |

The contacts themselves exist in the database, but they're never being linked to orders.

---

## Root Cause

The `contacts` table has a **partial unique INDEX**:
```sql
CREATE UNIQUE INDEX contacts_user_email_unique ON public.contacts 
USING btree (user_id, email) WHERE (email IS NOT NULL)
```

But PostgreSQL's `upsert` with `onConflict: 'user_id,email'` requires a proper **CONSTRAINT**, not just an index. The upsert fails silently, causing the contact linking to fail.

---

## Solution

### Step 1: Add a Proper Unique Constraint (SQL Migration)

```sql
-- Add a unique constraint (required for ON CONFLICT to work)
ALTER TABLE public.contacts
ADD CONSTRAINT contacts_user_id_email_unique UNIQUE (user_id, email);
```

### Step 2: Update Orders Edge Function

Modify `supabase/functions/orders/index.ts` to use the constraint name explicitly and add better error handling:

**Current code (lines 259-274):**
```typescript
const { error: senderUpsertError } = await supabase
  .from('contacts')
  .upsert({
    user_id: userId,
    name: body.sender.name,
    // ...
  }, { onConflict: 'user_id,email' })  // ❌ This doesn't work with partial index
```

**Fixed code:**
```typescript
const { data: senderContact, error: senderUpsertError } = await supabase
  .from('contacts')
  .upsert({
    user_id: userId,
    name: body.sender.name,
    email: senderEmail,
    phone: body.sender.phone || null,
    street: body.sender.address?.street || null,
    city: body.sender.address?.city || null,
    state: body.sender.address?.state || null,
    postal_code: body.sender.address?.zipCode || body.sender.address?.postal_code || body.sender.address?.postcode || null,
    country: body.sender.address?.country || null,
    lat: body.sender.address?.lat || null,
    lon: body.sender.address?.lon || null,
    updated_at: new Date().toISOString(),
  }, { 
    onConflict: 'user_id,email',
    ignoreDuplicates: false 
  })
  .select('id')
  .single()

if (senderUpsertError) {
  console.error('Failed to upsert sender contact:', senderUpsertError)
} else {
  senderContactId = senderContact?.id || null
  console.log('Sender contact upserted successfully:', senderContactId)
}
```

Same pattern for receiver contact.

---

## Files to Change

| File | Change |
|------|--------|
| New SQL Migration | Add `UNIQUE (user_id, email)` constraint to contacts table |
| `supabase/functions/orders/index.ts` | Simplify contact upsert to use single `.upsert().select()` pattern now that constraint exists |

---

## Step 3: Fix Existing Shopify Orders

After deploying the fix, run a one-time query to link existing Shopify orders to their contacts:

```sql
-- Link sender contacts
UPDATE orders o
SET sender_contact_id = c.id
FROM contacts c
WHERE o.user_id = c.user_id
  AND o.sender_contact_id IS NULL
  AND o.sender->>'email' IS NOT NULL
  AND LOWER(o.sender->>'email') = LOWER(c.email);

-- Link receiver contacts  
UPDATE orders o
SET receiver_contact_id = c.id
FROM contacts c
WHERE o.user_id = c.user_id
  AND o.receiver_contact_id IS NULL
  AND o.receiver->>'email' IS NOT NULL
  AND LOWER(o.receiver->>'email') = LOWER(c.email);
```

---

## Summary

1. **Database**: Add proper UNIQUE constraint to `contacts` table
2. **Edge Function**: Simplify upsert logic now that constraint exists
3. **Backfill**: Link existing orders to their contacts
