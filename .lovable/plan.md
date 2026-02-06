

# Fix: Contact Links Not Being Created for Orders

## Problem Summary

Order `00d7d814-d511-4c9b-8ba4-ed60e70ecc87` (and all recent orders from February 2026) do not have `sender_contact_id` and `receiver_contact_id` linked, even though both sender and receiver have email addresses.

---

## Root Cause Analysis

1. **Pattern Identified**: All orders created in February 2026 have `null` contact links, while older January 2026 orders have valid links
2. **Orders are created via API**: The Edge Function `supabase/functions/orders/index.ts` handles order creation
3. **Upsert silently failing**: The contact upsert code runs but doesn't successfully return contact IDs

**Technical Issue**: When using Supabase `.upsert()` with `.single()` and a CITEXT email column, the conflict resolution may fail to return the row's ID when:
- The row already exists (update path)
- The `onConflict` column uses CITEXT type
- The `.select('id').single()` pattern expects exactly one row but may get none on conflict

---

## Solution

Modify both the Edge Function and frontend service to use a more robust approach:

1. **Try INSERT first, then SELECT on conflict** - More reliable than upsert for getting the ID
2. **OR use separate INSERT/SELECT pattern** - First check if contact exists, then insert or update accordingly

### Preferred Approach: Two-Step Upsert Pattern

Instead of relying on `.upsert().select().single()`, use:

```typescript
// Step 1: Try to insert, ignore conflict
await supabase.from('contacts').upsert({...}, { 
  onConflict: 'user_id,email',
  ignoreDuplicates: false 
})

// Step 2: Fetch the contact ID by email
const { data: contact } = await supabase
  .from('contacts')
  .select('id')
  .eq('user_id', userId)
  .ilike('email', email.trim())
  .single()

return contact?.id || null
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/orders/index.ts` | Update contact upsert logic to use two-step pattern |
| `src/services/contactService.ts` | Update `upsertContact` function with same robust pattern |

---

## Implementation Details

### 1. Update Edge Function: `orders/index.ts`

**Lines 254-310** - Replace upsert + single pattern:

```typescript
// Upsert sender contact if email exists
if (body.sender?.email?.trim()) {
  const senderEmail = body.sender.email.trim().toLowerCase()
  
  // Step 1: Upsert the contact (don't rely on return value)
  await supabase
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
    }, { onConflict: 'user_id,email' })
  
  // Step 2: Fetch the contact ID
  const { data: senderContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .ilike('email', senderEmail)
    .maybeSingle()
  
  senderContactId = senderContact?.id || null
  console.log('Sender contact ID:', senderContactId)
}
```

Apply same pattern for receiver contact.

---

### 2. Update Frontend Service: `contactService.ts`

**Function `upsertContact`** - Use same two-step pattern:

```typescript
export const upsertContact = async (
  userId: string,
  contactData: UpsertContactData
): Promise<string | null> => {
  if (!contactData.email?.trim()) {
    console.log('Skipping contact upsert - no email provided')
    return null
  }

  const email = contactData.email.trim().toLowerCase()

  // Step 1: Upsert the contact
  await supabase.from('contacts').upsert(
    {
      user_id: userId,
      name: contactData.name,
      email: email,
      phone: contactData.phone || null,
      street: contactData.street || null,
      city: contactData.city || null,
      state: contactData.state || null,
      postal_code: contactData.postal_code || null,
      country: contactData.country || null,
      lat: contactData.lat || null,
      lon: contactData.lon || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,email' }
  )

  // Step 2: Fetch the contact ID
  const { data, error } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .ilike('email', email)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch contact ID:', error)
    return null
  }

  console.log('Contact upserted successfully:', data?.id)
  return data?.id || null
}
```

---

## Backfill Existing Orders (Optional)

After fixing the code, you can optionally backfill existing orders that are missing contact links:

```sql
-- Find orders missing contact links where contacts exist
UPDATE orders o
SET 
  sender_contact_id = (
    SELECT c.id FROM contacts c 
    WHERE c.user_id = o.user_id 
    AND LOWER(c.email::text) = LOWER(o.sender->>'email')
    LIMIT 1
  ),
  receiver_contact_id = (
    SELECT c.id FROM contacts c 
    WHERE c.user_id = o.user_id 
    AND LOWER(c.email::text) = LOWER(o.receiver->>'email')
    LIMIT 1
  )
WHERE 
  sender_contact_id IS NULL 
  OR receiver_contact_id IS NULL;
```

---

## Summary

| Task | Description |
|------|-------------|
| Fix Edge Function | Use two-step upsert pattern (upsert then select) |
| Fix Frontend Service | Apply same pattern to `contactService.ts` |
| Deploy | Redeploy Edge Function |
| Optional Backfill | Run SQL to link existing orders to contacts |

