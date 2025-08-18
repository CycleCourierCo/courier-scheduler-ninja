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
  "bike_details": {
    "brand": "Trek",
    "model": "Domane AL 2",
    "color": "Red",
    "size": "Medium",
    "description": "Road bike in excellent condition"
  },
  "order_options": {
    "is_ebay_order": false,
    "needs_payment_on_collection": false,
    "payment_amount": 0,
    "special_instructions": "Handle with care - new bike"
  },
  "delivery_instructions": {
    "collection_notes": "Bike is in the garage around the back",
    "delivery_notes": "Leave with concierge if not home",
    "estimated_value": 1200.00
  }
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "a3ae471c-4a93-44cd-b664-4db4aeeec70c",
    "tracking_number": "CCC754773995458CHRCH6",
    "status": "pending",
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
    "bike_details": {
      "brand": "Trek",
      "model": "Domane AL 2",
      "color": "Red",
      "size": "Medium",
      "description": "Road bike in excellent condition"
    },
    "order_options": {
      "is_ebay_order": false,
      "needs_payment_on_collection": false,
      "payment_amount": 0,
      "special_instructions": "Handle with care - new bike"
    },
    "delivery_instructions": {
      "collection_notes": "Bike is in the garage around the back",
      "delivery_notes": "Leave with concierge if not home",
      "estimated_value": 1200.00
    }
  }
}
```

### Get Order

Retrieves details for a specific order.

**Endpoint**: `GET /v1/orders/{order_id}`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
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

**Bike Details**:
- `brand` (string, max 50 chars)
- `model` (string, max 100 chars)
- `color` (string, max 30 chars)
- `size` (string, max 20 chars)

### Optional Fields

- `sender.company` (string, max 100 chars)
- `sender.address.line2` (string, max 200 chars)
- `receiver.address.line2` (string, max 200 chars)
- `bike_details.description` (string, max 500 chars)
- `order_options.*` (all optional, defaults provided)
- `delivery_instructions.*` (all optional)

## Order Status Values

- `pending` - Order created, awaiting scheduling
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
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "sender.email",
        "message": "Invalid email format"
      },
      {
        "field": "receiver.postal_code",
        "message": "Invalid UK postcode"
      }
    ]
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "API key does not have permission to create orders"
  }
}
```

### 409 Conflict
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_REQUEST",
    "message": "Order with this idempotency key already exists",
    "existing_order_id": "a3ae471c-4a93-44cd-b664-4db4aeeec70c"
  }
}
```

### 422 Unprocessable Entity
```json
{
  "success": false,
  "error": {
    "code": "BUSINESS_RULE_VIOLATION",
    "message": "Cannot deliver to this postcode area"
  }
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "API rate limit exceeded",
    "retry_after": 60
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "request_id": "req_1234567890"
  }
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
    "bike_details": {
      "brand": "Trek",
      "model": "Domane AL 2",
      "color": "Red",
      "size": "Medium"
    }
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
      bike_details: {
        brand: "Trek",
        model: "Domane AL 2",
        color: "Red",
        size: "Medium"
      }
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
        "bike_details": {
            "brand": "Trek",
            "model": "Domane AL 2",
            "color": "Red",
            "size": "Medium"
        }
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