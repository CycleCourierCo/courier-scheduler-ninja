

# Add `needs_inspection` Field to API

## Overview

Add support for the `needs_inspection` boolean field in the Orders API. This field indicates whether a bicycle requires inspection before delivery. It already exists in the database but is not currently exposed through the API.

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/orders/index.ts` | Accept and store `needs_inspection` field |
| `src/pages/ApiDocumentationPage.tsx` | Document the new field |

## Implementation Details

### 1. Edge Function (`supabase/functions/orders/index.ts`)

Add `needs_inspection` to the `orderData` object (around line 225):

```typescript
const orderData = {
  // ... existing fields ...
  needs_inspection: body.needsInspection || body.needs_inspection || false,
  // ... rest of fields ...
}
```

**Location**: Line 225, add before `created_via_api: true`

### 2. API Documentation (`src/pages/ApiDocumentationPage.tsx`)

#### Request Body Example (Lines 129-135)

Add the new field to the request example:

```json
"isEbayOrder": true,
"collectionCode": "EBAY123456",
"needsInspection": true,
"deliveryInstructions": "Please ring doorbell and wait"
```

#### Field Descriptions (Lines 148-151)

Add description after `collectionCode`:

```
needsInspection: (optional) Whether the bicycle requires inspection before delivery
```

#### Success Response (Lines 187-194)

Add to the response example:

```json
"collection_code": "EBAY123456",
"needs_payment_on_collection": false,
"needs_inspection": true,
"delivery_instructions": "Please ring doorbell and wait"
```

#### GET Order Response (Lines 230-238)

Add `needs_inspection` to the GET response example as well.

## Summary

| Change | Description |
|--------|-------------|
| Edge function | Accept `needsInspection` or `needs_inspection` from request body |
| Documentation | Add field to request example, field descriptions, and both response examples |

