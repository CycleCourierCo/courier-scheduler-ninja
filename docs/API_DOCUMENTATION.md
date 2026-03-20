# Cycle Courier API Documentation

## Overview

The Cycle Courier API allows customers to programmatically create and manage courier orders. This REST API provides a secure way to integrate courier services directly into your applications.

## Base URL

```
https://your-domain.com/api
```

## Authentication

All API requests require authentication using an API key. Include your API key in the request headers:

```
X-API-Key: your_api_key_here
```

### Getting an API Key

Contact our support team to request an API key for your account. API keys are tied to your customer account and inherit the same permissions.

## Rate Limiting

- **Rate Limit**: 100 requests per minute per API key
- **Burst Limit**: 10 requests per second

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Request limit per minute
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when the rate limit resets

## Idempotency

To prevent duplicate order creation, include an `Idempotency-Key` header with a unique identifier (UUID recommended):

```
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

## Bike Type Reference

You can specify bike types using either a string name or a numeric `type_id`. Using numeric IDs is recommended for reliability.

| ID | Bike Type | Price |
|----|-----------|-------|
| 1 | Non-Electric - Mountain Bike | £60 |
| 2 | Non-Electric - Road Bike | £60 |
| 3 | Non-Electric - Hybrid | £60 |
| 4 | Electric Bike - Under 25kg | £70 |
| 5 | Electric Bike - Over 25kg | £130 |
| 6 | Cargo Bike | £225 |
| 7 | Longtail Cargo Bike | £130 |
| 8 | Stationary Bike | £70 |
| 9 | Kids Bikes | £40 |
| 10 | BMX Bikes | £40 |
| 11 | Boxed Kids Bikes | £35 |
| 12 | Folding Bikes | £40 |
| 13 | Tandem | £110 |
| 14 | Travel Bike Box | £60 |
| 15 | Wheelset/Frameset | £35 |
| 16 | Bike Rack | £40 |
| 17 | Turbo Trainer | £40 |

## Orders API

### Create Order

Creates a new courier order in the system.

**Endpoint**: `POST /v1/orders`

**Headers**:
```
Content-Type: application/json
X-API-Key: your_api_key_here
Idempotency-Key: unique_identifier_here
```

**Request Body**:
```json
{
  "sender": {
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+44 7700 900123",
    "company": "Smith Cycles Ltd",
    "address": {
      "line1": "123 High Street",
      "line2": "Unit 5",
      "city": "London",
      "postal_code": "SW1A 1AA"
    }
  },
  "receiver": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+44 7700 900456",
    "address": {
      "line1": "456 Oak Avenue",
      "line2": "",
      "city": "London",
      "postal_code": "E1 6AN"
    }
  },
  "bikes": [
    {
      "brand": "Trek",
      "model": "Domane AL 2",
      "type_id": 2,
      "value": 1200
    }
  ],
  "bike_type_id": 2,
  "bike_value": 1200,
  "order_options": {
    "is_ebay_order": false,
    "needs_payment_on_collection": false,
    "payment_amount": 0,
    "special_instructions": "Handle with care - new bike"
  },
  "delivery_instructions": "Leave with concierge if not home",
  "needs_inspection": false
}
```

**Response** (201 Created):
```json
{
  "id": "a3ae471c-4a93-44cd-b664-4db4aeeec70c",
  "tracking_number": "CCC754773995458CHRCH6",
  "status": "created",
  "created_at": "2025-01-15T10:30:00Z",
  "sender": {
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+44 7700 900123",
    "company": "Smith Cycles Ltd",
    "address": {
      "line1": "123 High Street",
      "line2": "Unit 5",
      "city": "London",
      "postal_code": "SW1A 1AA"
    }
  },
  "receiver": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+44 7700 900456",
    "address": {
      "line1": "456 Oak Avenue",
      "line2": "",
      "city": "London",
      "postal_code": "E1 6AN"
    }
  },
  "bike_brand": "Trek",
  "bike_model": "Domane AL 2",
  "bike_type": "Non-Electric - Road Bike",
  "bike_value": 1200,
  "bikes": [
    {
      "brand": "Trek",
      "model": "Domane AL 2",
      "type": "Non-Electric - Road Bike",
      "value": 1200
    }
  ],
  "bike_quantity": 1,
  "is_bike_swap": false,
  "is_ebay_order": false,
  "collection_code": null,
  "needs_payment_on_collection": false,
  "needs_inspection": false,
  "delivery_instructions": "Leave with concierge if not home"
}
```

### Get Order

Retrieves details for a specific order.

**Endpoint**: `GET /v1/orders/{order_id}`

**Response** (200 OK):
```json
{
  "id": "a3ae471c-4a93-44cd-b664-4db4aeeec70c",
  "tracking_number": "CCC754773995458CHRCH6",
  "status": "in_transit",
  "created_at": "2025-01-15T10:30:00Z",
  "pickup_date": "2025-01-16T09:00:00Z",
  "delivery_date": "2025-01-16T15:00:00Z",
  "tracking_events": [
    {
      "event": "ORDER_CREATED",
      "timestamp": "2025-01-15T10:30:00Z",
      "description": "Order created with tracking number CCC754773995458CHRCH6"
    },
    {
      "event": "ORDER_ONTHEWAY",
      "timestamp": "2025-01-16T08:45:00Z",
      "description": "Driver is on the way to collect the bike"
    }
  ]
}
```

## Field Validation

### Required Fields

**Sender**:
- `name` (string, max 100 chars)
- `email` (valid email format)
- `phone` (UK format: +44...)
- `address.line1` (string, max 200 chars)
- `address.city` (string, max 100 chars)
- `address.postal_code` (valid UK postcode)

**Receiver**:
- `name` (string, max 100 chars)
- `email` (valid email format)
- `phone` (UK format: +44...)
- `address.line1` (string, max 200 chars)
- `address.city` (string, max 100 chars)
- `address.postal_code` (valid UK postcode)

**Bike Details** (provide `bikes` array OR `bike_brand`):
- `bikes[].brand` (string, max 50 chars)
- `bikes[].model` (string, max 100 chars)

### Optional Fields

- `sender.company` (string, max 100 chars)
- `sender.address.line2` (string, max 200 chars)
- `receiver.address.line2` (string, max 200 chars)
- `bike_type` (string — see Bike Type Reference above)
- `bike_type_id` (integer 1-17 — see Bike Type Reference above; takes precedence over `bike_type`)
- `bike_value` (number — estimated value in £)
- `bikes[].type` (string — bike type per bike)
- `bikes[].type_id` (integer 1-17 — numeric bike type per bike; takes precedence over `type`)
- `bikes[].value` (number — value per bike in £)
- `needs_inspection` (boolean, default false)
- `order_options.*` (all optional, defaults provided)
- `delivery_instructions` (string)

## Order Status Values

- `created` - Order created, awaiting scheduling
- `scheduled` - Pickup and delivery times confirmed
- `collecting` - Driver en route to collection address
- `collected` - Bike collected from sender
- `in_transit` - En route to delivery address
- `delivering` - Driver en route to delivery address
- `delivered` - Successfully delivered to receiver
- `cancelled` - Order cancelled
- `failed` - Delivery attempt failed

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid bike_type_id: 99. Must be 1-17.",
  "code": "VALIDATION_ERROR"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid or missing API key",
  "code": "INVALID_API_KEY"
}
```

### 409 Conflict
```json
{
  "error": "Order with this idempotency key already exists",
  "code": "DUPLICATE_REQUEST",
  "existing_order_id": "a3ae471c-4a93-44cd-b664-4db4aeeec70c"
}
```

### 429 Too Many Requests
```json
{
  "error": "API rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "An unexpected error occurred",
  "code": "INTERNAL_ERROR"
}
```

## Code Examples

### cURL
```bash
curl -X POST https://your-domain.com/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "sender": {
      "name": "John Smith",
      "email": "john@example.com",
      "phone": "+44 7700 900123",
      "address": {
        "line1": "123 High Street",
        "city": "London",
        "postal_code": "SW1A 1AA"
      }
    },
    "receiver": {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+44 7700 900456",
      "address": {
        "line1": "456 Oak Avenue",
        "city": "London",
        "postal_code": "E1 6AN"
      }
    },
    "bikes": [
      {
        "brand": "Trek",
        "model": "Domane AL 2",
        "type_id": 2,
        "value": 1200
      }
    ],
    "bike_type_id": 2,
    "bike_value": 1200
  }'
```

### JavaScript (Node.js)
```javascript
const axios = require('axios');

const createOrder = async () => {
  try {
    const response = await axios.post('https://your-domain.com/api/v1/orders', {
      sender: {
        name: "John Smith",
        email: "john@example.com",
        phone: "+44 7700 900123",
        address: {
          line1: "123 High Street",
          city: "London",
          postal_code: "SW1A 1AA"
        }
      },
      receiver: {
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "+44 7700 900456",
        address: {
          line1: "456 Oak Avenue",
          city: "London",
          postal_code: "E1 6AN"
        }
      },
      bikes: [
        {
          brand: "Trek",
          model: "Domane AL 2",
          type_id: 2,
          value: 1200
        }
      ],
      bike_type_id: 2,
      bike_value: 1200
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'your_api_key_here',
        'Idempotency-Key': require('crypto').randomUUID()
      }
    });

    console.log('Order created:', response.data);
  } catch (error) {
    console.error('Error creating order:', error.response?.data || error.message);
  }
};

createOrder();
```

### Python
```python
import requests
import uuid

def create_order():
    url = "https://your-domain.com/api/v1/orders"
    
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": "your_api_key_here",
        "Idempotency-Key": str(uuid.uuid4())
    }
    
    data = {
        "sender": {
            "name": "John Smith",
            "email": "john@example.com",
            "phone": "+44 7700 900123",
            "address": {
                "line1": "123 High Street",
                "city": "London",
                "postal_code": "SW1A 1AA"
            }
        },
        "receiver": {
            "name": "Jane Doe",
            "email": "jane@example.com",
            "phone": "+44 7700 900456",
            "address": {
                "line1": "456 Oak Avenue",
                "city": "London",
                "postal_code": "E1 6AN"
            }
        },
        "bikes": [
            {
                "brand": "Trek",
                "model": "Domane AL 2",
                "type_id": 2,
                "value": 1200
            }
        ],
        "bike_type_id": 2,
        "bike_value": 1200
    }
    
    try:
        response = requests.post(url, json=data, headers=headers)
        response.raise_for_status()
        print("Order created:", response.json())
    except requests.exceptions.RequestException as e:
        print("Error creating order:", e)

create_order()
```

## Support

For API support, documentation updates, or to request an API key:
- Email: api-support@cyclecourier.com
- Documentation: https://docs.cyclecourier.com
- Status Page: https://status.cyclecourier.com
