# Cycle Courier Webhook Documentation

## Overview

Webhooks allow you to receive real-time notifications about order events in your applications. When specific events occur in our system, we'll send an HTTP POST request to your configured webhook endpoint.

## Webhook Configuration

### Setting Up Webhooks

Contact our support team to configure webhook endpoints for your account. You'll need to provide:

1. **Endpoint URL**: The HTTPS URL where you want to receive webhook notifications
2. **Events**: Which events you want to subscribe to
3. **Secret**: We'll provide a secret key for verifying webhook authenticity

### Webhook Requirements

- **HTTPS Required**: Webhook endpoints must use HTTPS
- **Response Time**: Your endpoint should respond within 10 seconds
- **Response Code**: Return a 2xx status code to acknowledge receipt
- **Idempotency**: Handle duplicate events gracefully

## Webhook Events

### order.created

Triggered when a new order is created in the system.

```json
{
  "event": "order.created",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "order_id": "a3ae471c-4a93-44cd-b664-4db4aeeec70c",
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
    }
  }
}
```

### order.status.updated

Triggered when an order's status changes.

```json
{
  "event": "order.status.updated",
  "timestamp": "2025-01-16T09:15:00Z",
  "data": {
    "order_id": "a3ae471c-4a93-44cd-b664-4db4aeeec70c",
    "tracking_number": "CCC754773995458CHRCH6",
    "previous_status": "pending",
    "current_status": "scheduled",
    "pickup_date": "2025-01-16T09:00:00Z",
    "delivery_date": "2025-01-16T15:00:00Z"
  }
}
```

### order.collection.started

Triggered when the driver begins traveling to the collection address.

```json
{
  "event": "order.collection.started",
  "timestamp": "2025-01-16T08:45:00Z",
  "data": {
    "order_id": "a3ae471c-4a93-44cd-b664-4db4aeeec70c",
    "tracking_number": "CCC754773995458CHRCH6",
    "status": "collecting",
    "driver": {
      "name": "Mike Johnson",
      "phone": "+44 7700 900789"
    },
    "estimated_collection_time": "2025-01-16T09:00:00Z"
  }
}
```

### order.collection.completed

Triggered when the bike has been successfully collected from the sender.

```json
{
  "event": "order.collection.completed",
  "timestamp": "2025-01-16T09:15:00Z",
  "data": {
    "order_id": "a3ae471c-4a93-44cd-b664-4db4aeeec70c",
    "tracking_number": "CCC754773995458CHRCH6",
    "status": "collected",
    "collection_time": "2025-01-16T09:15:00Z",
    "driver": {
      "name": "Mike Johnson",
      "phone": "+44 7700 900789"
    }
  }
}
```

### order.delivery.started

Triggered when the driver begins traveling to the delivery address.

```json
{
  "event": "order.delivery.started",
  "timestamp": "2025-01-16T14:30:00Z",
  "data": {
    "order_id": "a3ae471c-4a93-44cd-b664-4db4aeeec70c",
    "tracking_number": "CCC754773995458CHRCH6",
    "status": "delivering",
    "driver": {
      "name": "Mike Johnson",
      "phone": "+44 7700 900789"
    },
    "estimated_delivery_time": "2025-01-16T15:00:00Z"
  }
}
```

### order.delivery.completed

Triggered when the bike has been successfully delivered to the receiver.

```json
{
  "event": "order.delivery.completed",
  "timestamp": "2025-01-16T15:10:00Z",
  "data": {
    "order_id": "a3ae471c-4a93-44cd-b664-4db4aeeec70c",
    "tracking_number": "CCC754773995458CHRCH6",
    "status": "delivered",
    "delivery_time": "2025-01-16T15:10:00Z",
    "driver": {
      "name": "Mike Johnson",
      "phone": "+44 7700 900789"
    }
  }
}
```

### order.delivery.failed

Triggered when a delivery attempt fails.

```json
{
  "event": "order.delivery.failed",
  "timestamp": "2025-01-16T15:30:00Z",
  "data": {
    "order_id": "a3ae471c-4a93-44cd-b664-4db4aeeec70c",
    "tracking_number": "CCC754773995458CHRCH6",
    "status": "failed",
    "failure_reason": "Recipient not available",
    "failure_time": "2025-01-16T15:30:00Z",
    "driver": {
      "name": "Mike Johnson",
      "phone": "+44 7700 900789"
    },
    "retry_scheduled": true,
    "next_attempt_date": "2025-01-17T10:00:00Z"
  }
}
```

### order.cancelled

Triggered when an order is cancelled.

```json
{
  "event": "order.cancelled",
  "timestamp": "2025-01-16T11:00:00Z",
  "data": {
    "order_id": "a3ae471c-4a93-44cd-b664-4db4aeeec70c",
    "tracking_number": "CCC754773995458CHRCH6",
    "status": "cancelled",
    "cancellation_reason": "Customer request",
    "cancelled_by": "customer",
    "cancelled_at": "2025-01-16T11:00:00Z"
  }
}
```

## Webhook Security

### Signature Verification

Each webhook request includes an `X-Webhook-Signature` header containing an HMAC SHA-256 signature. Verify this signature to ensure the webhook is from Cycle Courier and hasn't been tampered with.

**Header Format**:
```
X-Webhook-Signature: sha256=1234567890abcdef...
```

**Verification Process**:
1. Extract the signature from the header (remove the `sha256=` prefix)
2. Create an HMAC SHA-256 hash of the request body using your webhook secret
3. Compare the computed hash with the provided signature

### Code Examples

#### Node.js (Express)
```javascript
const crypto = require('crypto');
const express = require('express');
const app = express();

app.use(express.raw({ type: 'application/json' }));

function verifyWebhookSignature(body, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');
  
  const providedSignature = signature.replace('sha256=', '');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(providedSignature, 'hex')
  );
}

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;
  
  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(req.body);
  
  // Process the webhook event
  console.log('Received webhook:', event.event, event.data.order_id);
  
  res.status(200).send('OK');
});
```

#### Python (Flask)
```python
import hashlib
import hmac
import json
from flask import Flask, request

app = Flask(__name__)

def verify_webhook_signature(body, signature, secret):
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        body,
        hashlib.sha256
    ).hexdigest()
    
    provided_signature = signature.replace('sha256=', '')
    
    return hmac.compare_digest(expected_signature, provided_signature)

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Webhook-Signature')
    secret = os.environ.get('WEBHOOK_SECRET')
    
    if not verify_webhook_signature(request.data, signature, secret):
        return 'Invalid signature', 401
    
    event = request.json
    
    # Process the webhook event
    print(f"Received webhook: {event['event']} {event['data']['order_id']}")
    
    return 'OK', 200
```

#### PHP
```php
<?php
function verifyWebhookSignature($body, $signature, $secret) {
    $expectedSignature = hash_hmac('sha256', $body, $secret);
    $providedSignature = str_replace('sha256=', '', $signature);
    
    return hash_equals($expectedSignature, $providedSignature);
}

$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';
$secret = $_ENV['WEBHOOK_SECRET'];
$body = file_get_contents('php://input');

if (!verifyWebhookSignature($body, $signature, $secret)) {
    http_response_code(401);
    exit('Invalid signature');
}

$event = json_decode($body, true);

// Process the webhook event
error_log("Received webhook: " . $event['event'] . " " . $event['data']['order_id']);

http_response_code(200);
echo 'OK';
?>
```

## Retry Logic

### Automatic Retries

If your webhook endpoint returns a non-2xx status code or doesn't respond within 10 seconds, we'll automatically retry the webhook with an exponential backoff strategy:

- **1st retry**: After 1 minute
- **2nd retry**: After 5 minutes
- **3rd retry**: After 15 minutes
- **4th retry**: After 1 hour
- **5th retry**: After 6 hours
- **Final retry**: After 24 hours

After 6 failed attempts over 24 hours, we'll stop retrying and mark the webhook as failed.

### Manual Retry

You can request manual retries for failed webhooks through our dashboard or by contacting support.

## Best Practices

### Endpoint Implementation

1. **Respond Quickly**: Return a 2xx status code as soon as possible
2. **Process Asynchronously**: Queue webhook events for background processing
3. **Handle Duplicates**: Use `order_id` and `timestamp` to detect duplicate events
4. **Log Everything**: Maintain detailed logs for debugging
5. **Validate Signatures**: Always verify webhook signatures

### Error Handling

```javascript
app.post('/webhook', async (req, res) => {
  try {
    // Acknowledge receipt immediately
    res.status(200).send('OK');
    
    // Queue for background processing
    await queueWebhookEvent(req.body);
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Don't return error status - we've already acknowledged
  }
});

async function processWebhookEvent(event) {
  try {
    // Check if we've already processed this event
    if (await isEventProcessed(event.data.order_id, event.timestamp)) {
      console.log('Duplicate event detected, skipping');
      return;
    }
    
    // Process the event based on type
    switch (event.event) {
      case 'order.created':
        await handleOrderCreated(event.data);
        break;
      case 'order.status.updated':
        await handleOrderStatusUpdated(event.data);
        break;
      // ... other event types
    }
    
    // Mark event as processed
    await markEventProcessed(event.data.order_id, event.timestamp);
    
  } catch (error) {
    console.error('Error processing webhook event:', error);
    throw error; // Re-throw for retry logic
  }
}
```

### Database Design

Consider storing webhook events for audit and debugging:

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_timestamp TIMESTAMP NOT NULL,
  processed_at TIMESTAMP,
  raw_payload JSONB NOT NULL,
  processing_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_order_id ON webhook_events(order_id);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_timestamp ON webhook_events(event_timestamp);
```

## Testing Webhooks

### Test Endpoints

Use tools like ngrok to expose your local development server for webhook testing:

```bash
# Install ngrok
npm install -g ngrok

# Expose your local server
ngrok http 3000

# Use the provided HTTPS URL as your webhook endpoint
# Example: https://abc123.ngrok.io/webhook
```

### Webhook Debugging

1. **Check Logs**: Monitor your application logs for webhook processing
2. **Verify Signatures**: Ensure signature verification is working correctly
3. **Test Timeouts**: Simulate slow responses to test retry behavior
4. **Handle Edge Cases**: Test with malformed or unexpected payloads

## Webhook Event History

You can view webhook delivery history and retry attempts in our dashboard. Each webhook event includes:

- **Delivery Status**: Success, Failed, or Retrying
- **Response Code**: HTTP status code returned by your endpoint
- **Response Time**: How long your endpoint took to respond
- **Retry Attempts**: Number of retry attempts made
- **Next Retry**: When the next retry will be attempted (if applicable)

## Support

For webhook support, configuration, or troubleshooting:
- Email: webhook-support@cyclecourier.com
- Documentation: https://docs.cyclecourier.com/webhooks
- Dashboard: https://dashboard.cyclecourier.com/webhooks
