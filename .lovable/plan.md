

# Enable Sender & Receiver Address Editing with Geocoding

## Overview

This feature extends the `AdminContactEditor` component to allow full address editing, including automatic geocoding to update coordinates when addresses change.

## Current Architecture

| Storage | Purpose | What This Feature Will Do |
|---------|---------|---------------------------|
| **JSONB columns** (`sender`, `receiver`) | Snapshot of contact details for each order | Update all fields including coordinates |
| **Contact references** (`sender_contact_id`, `receiver_contact_id`) | Links to address book | NOT modified (preserves master records) |

The edited values will update only the order's JSONB snapshot, not the related contact records in the address book.

## Implementation Details

### 1. Create Geocoding Utility

**New File:** `src/utils/geocoding.ts`

A reusable utility function that mirrors the edge function's geocoding logic:

```typescript
export async function geocodeAddress(addressString: string): Promise<{ lat: number; lon: number } | null> {
  const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(addressString)}&filter=countrycode:gb&apiKey=${apiKey}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.features?.length > 0) {
    const coords = data.features[0].geometry.coordinates;
    return { lat: coords[1], lon: coords[0] };
  }
  return null;
}
```

### 2. Extend AdminContactEditor Component

**File:** `src/components/order-detail/AdminContactEditor.tsx`

#### State Expansion

Current state (email, phone only):
```typescript
const [editedContact, setEditedContact] = useState({
  email: contact.email,
  phone: contact.phone
});
```

Updated state (all editable fields):
```typescript
const [editedContact, setEditedContact] = useState({
  name: contact.name,
  email: contact.email,
  phone: contact.phone,
  street: contact.address.street,
  city: contact.address.city,
  state: contact.address.state,
  zipCode: contact.address.zipCode,
  country: contact.address.country
});
```

#### Save Handler with Geocoding

```typescript
const handleSave = async () => {
  setIsSaving(true);
  
  // Build full address string for geocoding
  const addressString = [
    editedContact.street,
    editedContact.city,
    editedContact.state,
    editedContact.zipCode,
    editedContact.country
  ].filter(Boolean).join(', ');
  
  // Fetch new coordinates
  const coordinates = await geocodeAddress(addressString);
  
  // Merge all fields including new coordinates
  const updatedContact = {
    ...currentOrder[fieldName],
    name: editedContact.name,
    email: editedContact.email,
    phone: editedContact.phone,
    address: {
      ...currentOrder[fieldName].address,
      street: editedContact.street,
      city: editedContact.city,
      state: editedContact.state,
      zipCode: editedContact.zipCode,
      country: editedContact.country,
      ...(coordinates && { lat: coordinates.lat, lon: coordinates.lon })
    }
  };
  
  // Save to database
  await supabase.from('orders').update({ [fieldName]: updatedContact }).eq('id', orderId);
};
```

#### Updated UI Layout

When in edit mode, the form displays:

```text
+--------------------------------------------+
| Name                                       |
+--------------------------------------------+
| Email                    | Phone           |
+--------------------------------------------+
| Street Address                             |
+--------------------------------------------+
| City                     | County/State    |
+--------------------------------------------+
| Postcode                 | Country         |
+--------------------------------------------+
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/utils/geocoding.ts` | **Create** - Geocoding utility function |
| `src/components/order-detail/AdminContactEditor.tsx` | **Modify** - Add address fields and geocoding on save |

## User Experience

1. Admin clicks "Edit Contact" on sender or receiver section
2. All fields become editable: name, email, phone, street, city, state, postcode, country
3. Admin makes changes and clicks "Save"
4. System geocodes the new address to get updated coordinates
5. Order's JSONB column is updated with all new values including lat/lon
6. Toast confirms success (or shows geocoding warning if coordinates couldn't be fetched)

## Notes

- If geocoding fails, the address is still saved but coordinates may be stale - a warning toast will inform the admin
- The `VITE_GEOAPIFY_API_KEY` environment variable is already configured in the project
- Only admins see the Edit button (existing conditional rendering)

