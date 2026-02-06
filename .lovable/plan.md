

# Update Shopify Webhook for New Metafield Structure

## Problem

The webhook received the new metafields but the code still looks for the old field names:

| Data | Old Field (Code Expects) | New Field (Webhook Receives) |
|------|--------------------------|------------------------------|
| Bike Info | `Bike Brand and Model` | `Bike Brand` + `Bike Model` |
| Collection Address | `Collection Address` | 4 separate fields |
| Delivery Address | `Delivery Address` | 4 separate fields |

**Current result**: Empty addresses and bike brand shows "Collection and Delivery within England and Wales" instead of "Specialized".

---

## New Metafield Names (From Webhook Logs)

**Bike:**
- `Bike Brand` → "Specialized"
- `Bike Model` → "Tarmac"

**Collection:**
- `Collection Name`
- `Collection Email`
- `Collection Mobile Number`
- `Collection Street Address`
- `Collection City`
- `Collection County`
- `Collection Postcode`

**Delivery:**
- `Delivery Name`
- `Delivery Email`
- `Delivery Mobile Number`
- `Delivery Street Address`
- `Delivery City`
- `Delivery County`
- `Delivery Postcode`

---

## Changes Required

### File: `supabase/functions/shopify-webhook/index.ts`

### 1. Add Postcode-Only Geocoding Function

Replace the current `geocodeAddress` function with a simpler postcode-only version:

```typescript
async function geocodePostcode(postcode: string): Promise<{lat?: number; lon?: number} | null> {
  if (!postcode) return null;
  
  try {
    const apiKey = Deno.env.get('VITE_GEOAPIFY_API_KEY');
    if (!apiKey) {
      console.warn('Geoapify API key not configured');
      return null;
    }

    const cleanPostcode = postcode.trim().toUpperCase();
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(cleanPostcode)}&filter=countrycode:gb&apiKey=${apiKey}`;
    
    console.log('Geocoding postcode:', cleanPostcode);
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Geocoding failed:', response.status);
      return null;
    }

    const data = await response.json();
    if (!data.features?.length) {
      console.warn('No geocoding results for postcode:', cleanPostcode);
      return null;
    }

    const result = data.features[0].properties;
    console.log('Geocoded postcode result:', { lat: result.lat, lon: result.lon });
    return { lat: result.lat, lon: result.lon };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}
```

### 2. Update Bike Brand/Model Extraction (Lines 231-243)

**Before:**
```typescript
const bikeBrandAndModel = getPropertyValue(properties, 'Bike Brand and Model');
if (bikeBrandAndModel) {
  const parts = bikeBrandAndModel.split(' ');
  bikeBrand = parts[0] || '';
  bikeModel = parts.slice(1).join(' ') || '';
} else {
  bikeBrand = firstItem.title || 'Collection';
  bikeModel = firstItem.variant_title || 'and Delivery';
}
```

**After:**
```typescript
// Extract bike brand and model from separate properties
bikeBrand = getPropertyValue(properties, 'Bike Brand') || firstItem.title || 'Unknown';
bikeModel = getPropertyValue(properties, 'Bike Model') || firstItem.variant_title || '';
console.log('Parsed bike:', { bikeBrand, bikeModel });
```

### 3. Update Sender (Collection) Extraction (Lines 248-271)

**Before:**
```typescript
const collectionAddressStr = getPropertyValue(properties, 'Collection Address');
const geocodedCollectionAddress = await geocodeAddress(collectionAddressStr);
const collectionAddress = geocodedCollectionAddress || parseAddress(collectionAddressStr);

sender = {
  name: collectionName || shopifyOrder.billing_address?.name || 'Unknown',
  email: collectionEmail || shopifyOrder.email || '',
  phone: formatPhoneNumber(collectionPhone) || '',
  address: {
    street: collectionAddress.street,
    city: collectionAddress.city,
    state: collectionAddress.state || ...,
    zip: collectionAddress.zipCode,
    ...
  }
};
```

**After:**
```typescript
// Extract collection address from individual properties
const collectionStreet = getPropertyValue(properties, 'Collection Street Address') || '';
const collectionCity = getPropertyValue(properties, 'Collection City') || '';
const collectionCounty = getPropertyValue(properties, 'Collection County') || '';
const collectionPostcode = getPropertyValue(properties, 'Collection Postcode') || '';

// Geocode using ONLY the postcode
const collectionGeo = await geocodePostcode(collectionPostcode);

sender = {
  name: collectionName || shopifyOrder.billing_address?.name || 'Unknown',
  email: collectionEmail || shopifyOrder.email || '',
  phone: formatPhoneNumber(collectionPhone) || '',
  address: {
    street: collectionStreet,
    city: collectionCity,
    state: collectionCounty || shopifyOrder.billing_address?.province || 'England',
    zip: collectionPostcode,
    country: 'United Kingdom',
    lat: collectionGeo?.lat,
    lon: collectionGeo?.lon
  }
};

console.log('Parsed sender:', sender);
```

### 4. Update Receiver (Delivery) Extraction (Lines 275-298)

**After:**
```typescript
// Extract delivery address from individual properties
const deliveryStreet = getPropertyValue(properties, 'Delivery Street Address') || '';
const deliveryCity = getPropertyValue(properties, 'Delivery City') || '';
const deliveryCounty = getPropertyValue(properties, 'Delivery County') || '';
const deliveryPostcode = getPropertyValue(properties, 'Delivery Postcode') || '';

// Geocode using ONLY the postcode
const deliveryGeo = await geocodePostcode(deliveryPostcode);

receiver = {
  name: deliveryName || sender.name,
  email: deliveryEmail || sender.email,
  phone: formatPhoneNumber(deliveryPhone) || sender.phone,
  address: {
    street: deliveryStreet,
    city: deliveryCity,
    state: deliveryCounty || '',
    zip: deliveryPostcode,
    country: 'United Kingdom',
    lat: deliveryGeo?.lat,
    lon: deliveryGeo?.lon
  }
};

console.log('Parsed receiver:', receiver);
```

### 5. Remove Obsolete Functions

Remove the old `geocodeAddress` and `parseAddress` functions (lines 47-107) as they are no longer needed.

---

## Expected Result After Fix

When a Shopify order comes in with:
```json
{ "name": "Bike Brand", "value": "Specialized" },
{ "name": "Bike Model", "value": "Tarmac" },
{ "name": "Collection Street Address", "value": "339 Haunch lane" },
{ "name": "Collection City", "value": "Birmingham" },
{ "name": "Collection County", "value": "West midlands" },
{ "name": "Collection Postcode", "value": "B130pl" },
...
```

The order will be created with:
- **Bike Brand**: "Specialized"
- **Bike Model**: "Tarmac"
- **Sender Address**: 339 Haunch lane, Birmingham, West midlands, B13 0PL
- **Sender Coordinates**: Geocoded from "B130pl"
- **Receiver Address**: 108 Brentford Road, London, Bucks, HP13 6XU
- **Receiver Coordinates**: Geocoded from "Hp136xu"

---

## Summary

| Change | Description |
|--------|-------------|
| Bike fields | Read `Bike Brand` and `Bike Model` separately |
| Collection address | Read from 4 individual fields |
| Delivery address | Read from 4 individual fields |
| Geocoding | Use postcode-only function |
| Cleanup | Remove obsolete `geocodeAddress` and `parseAddress` |

