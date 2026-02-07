

# Fix API Documentation Field Accuracy

## Overview

The API documentation page contains several inaccuracies between what's documented and what the actual API returns. The main issues are:

1. **Response fields use snake_case, not camelCase** - Documentation shows `trackingNumber`, actual API returns `tracking_number`
2. **`customerOrderNumber` is NOT in the response** - It's accepted in requests but not returned
3. **Response structure differs from documentation** - No `bikes` array, no `updatedAt`, separate `bike_brand`/`bike_model` fields

## Detailed Field Comparison

### Request Body (Currently Accurate)

The documentation correctly shows camelCase input fields. The API accepts both camelCase and snake_case, but documenting camelCase is fine.

| Documented Field | API Accepts | Status |
|------------------|-------------|--------|
| `bikeQuantity` | ✓ `bikeQuantity` or `bike_quantity` | OK |
| `bikes[].brand/model` | ✓ `bikes` array or `bike_brand` | OK |
| `customerOrderNumber` | ✓ `customerOrderNumber` or `customer_order_number` | OK |
| `isEbayOrder` | ✓ `isEbayOrder` or `is_ebay_order` | OK |
| `collectionCode` | ✓ `collectionCode` or `collection_code` | OK |
| `needsPaymentOnCollection` | ✓ both formats | OK |
| `deliveryInstructions` | ✓ both formats | OK |

### Response Body (Needs Fixing)

| Documented (Wrong) | Actual API Response | Fix Required |
|--------------------|---------------------|--------------|
| `trackingNumber` | `tracking_number` | Change to snake_case |
| `bikeQuantity` | `bike_quantity` | Change to snake_case |
| `bikes: [...]` | `bike_brand`, `bike_model` | Replace with separate fields |
| `customerOrderNumber` | Not returned | Remove from response |
| `needsPaymentOnCollection` | `needs_payment_on_collection` | Change to snake_case |
| `isEbayOrder` | `is_ebay_order` | Change to snake_case |
| `collectionCode` | `collection_code` | Change to snake_case |
| `createdAt` | `created_at` | Change to snake_case |
| `updatedAt` | Not returned | Remove from response |
| `isBikeSwap` | `is_bike_swap` | Add (was missing) |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/ApiDocumentationPage.tsx` | Update response examples to match actual API output |

## Corrected Response Example

```json
{
  "id": "ord_1234567890",
  "tracking_number": "CC-TR-ABC123",
  "status": "created",
  "created_at": "2024-01-15T10:30:00.000Z",
  "sender": {
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+44 7700 900123",
    "address": {
      "street": "123 High Street",
      "city": "London",
      "state": "London",
      "zipCode": "SW1A 1AA",
      "country": "UK"
    }
  },
  "receiver": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+44 7700 900456",
    "address": {
      "street": "456 Oak Avenue",
      "city": "London",
      "state": "London",
      "zipCode": "E1 6AN",
      "country": "UK"
    }
  },
  "bike_brand": "Trek",
  "bike_model": "Domane AL 2",
  "bike_quantity": 1,
  "is_bike_swap": false,
  "is_ebay_order": true,
  "collection_code": "EBAY123456",
  "needs_payment_on_collection": false,
  "delivery_instructions": "Please ring doorbell and wait"
}
```

## Additional Documentation Updates

### Field Descriptions Section

Update to clarify that `customerOrderNumber` is stored but not echoed back in the response.

### Get Order Response

The GET endpoint returns the full order object from the database (line 553-554), so it includes all fields. Add note that GET returns additional fields like `customer_order_number`, `updated_at`, etc.

## Summary of Changes

1. **Lines 157-199**: Update success response example to use snake_case and correct field list
2. **Lines 142-152**: Add note that `customerOrderNumber` is stored but not returned in create response
3. **Lines 221-246**: Update GET order response example if needed

