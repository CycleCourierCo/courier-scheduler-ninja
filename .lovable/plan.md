

## Extend Dashboard Search to Include Phone, Email, and Postcode

### Problem
The current search only matches against sender/receiver name, tracking number, bike brand/model, and customer order number. Users need to find orders by phone number, email, or postcode from the sender/receiver JSONB fields.

### Change

**`src/services/orderService.ts`** (lines 152-159) — Add additional JSONB search paths to the `.or()` filter:

```
sender->>email.ilike.%term%
receiver->>email.ilike.%term%
sender->>phone.ilike.%term%
receiver->>phone.ilike.%term%
sender->address->>zipCode.ilike.%term%
receiver->address->>zipCode.ilike.%term%
```

**`src/utils/dashboardUtils.ts`** (lines 39-46) — Update the client-side `applyFiltersToOrders` search to also match against `sender.email`, `sender.phone`, `receiver.email`, `receiver.phone`, `sender.address.zipCode`, and `receiver.address.zipCode`.

**`src/components/OrderFilters.tsx`** — Update the search input placeholder text to indicate phone/email/postcode are searchable.

### Technical Note
The sender/receiver fields are stored as JSONB in the database. Supabase supports nested JSONB path queries with `->>` (text) and `->` (object) operators, so `sender->address->>zipCode` will work for the nested postcode field.

