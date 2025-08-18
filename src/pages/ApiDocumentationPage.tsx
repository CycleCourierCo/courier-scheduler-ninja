import React from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Code, Key, Zap, Globe, Shield, Bell, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const ApiDocumentationPage = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">API Documentation</h1>
          <p className="text-muted-foreground text-lg">
            Integrate with Cycle Courier's REST API to create and manage orders programmatically.
          </p>
        </div>

        {/* Quick Start */}
        <div className="grid gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Quick Start
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Base URL</h3>
                <code className="bg-muted px-3 py-1 rounded text-sm">
                  https://api.cyclecourierco.com/v1
                </code>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Authentication</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  All requests require an API key in the headers:
                </p>
                <code className="bg-muted px-3 py-1 rounded text-sm block">
                  X-API-Key: your_api_key_here
                </code>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Rate Limiting</h3>
                <p className="text-sm text-muted-foreground">
                  100 requests per minute per API key
                </p>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>API Key Management:</strong> API keys are generated and managed by Cycle Courier administrators. 
              Contact support with your business details to request an API key. Keys will be linked to your business account 
              and all orders created via API will appear in your dashboard.
            </AlertDescription>
          </Alert>
        </div>

        <Separator className="my-8" />

        {/* Orders API */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Orders API</h2>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Create Order
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="default">POST</Badge>
                  <code className="text-sm">/orders</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Create a new courier order with complete sender, receiver, and item details.
                </p>
                
                <div>
                  <h4 className="font-semibold mb-2">Required Headers</h4>
                  <pre className="bg-muted p-3 rounded text-sm">
{`X-API-Key: your_api_key_here
Content-Type: application/json
Idempotency-Key: unique_request_id (optional)`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Request Body</h4>
                  <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{`{
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
  "bikeQuantity": 1,
  "bikes": [
    {
      "brand": "Trek",
      "model": "Domane AL 2"
    }
  ],
  "customerOrderNumber": "ORD-12345",
  "needsPaymentOnCollection": false,
  "paymentCollectionPhone": "+44 7700 900789",
  "isBikeSwap": false,
  "isEbayOrder": true,
  "collectionCode": "EBAY123456",
  "deliveryInstructions": "Please ring doorbell and wait"
}`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Field Descriptions</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>bikeQuantity:</strong> <em>(required)</em> Number of bikes being transported</div>
                    <div><strong>bikes:</strong> <em>(required)</em> Array of bike details with brand and model</div>
                    <div><strong>customerOrderNumber:</strong> <em>(optional)</em> Your internal order reference</div>
                    <div><strong>needsPaymentOnCollection:</strong> <em>(optional)</em> Whether payment is required on collection</div>
                    <div><strong>paymentCollectionPhone:</strong> <em>(optional)</em> Phone number for payment collection</div>
                    <div><strong>isBikeSwap:</strong> <em>(optional)</em> Whether this is a bike exchange/swap</div>
                    <div><strong>isEbayOrder:</strong> <em>(optional)</em> Whether this is an eBay order</div>
                    <div><strong>collectionCode:</strong> <em>(optional)</em> eBay collection code or similar reference</div>
                    <div><strong>deliveryInstructions:</strong> <em>(optional)</em> Special delivery instructions</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Success Response (201 Created)</h4>
                  <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{`{
  "id": "ord_1234567890",
  "trackingNumber": "CC-TR-ABC123",
  "status": "created",
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
  "bikeQuantity": 1,
  "bikes": [
    {
      "brand": "Trek",
      "model": "Domane AL 2"
    }
  ],
  "customerOrderNumber": "ORD-12345",
  "needsPaymentOnCollection": false,
  "isEbayOrder": true,
  "collectionCode": "EBAY123456",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Get Order Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">GET</Badge>
                  <code className="text-sm">/orders/{`{order_id}`}</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Retrieve detailed information about a specific order, including current status and tracking events.
                </p>
                
                <div>
                  <h4 className="font-semibold mb-2">Example Response</h4>
                  <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{`{
  "id": "ord_1234567890",
  "trackingNumber": "CC-TR-ABC123",
  "status": "collected",
  "sender": { ... },
  "receiver": { ... },
  "trackingEvents": [
    {
      "status": "created",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "description": "Order created"
    },
    {
      "status": "driver_to_collection", 
      "timestamp": "2024-01-15T14:00:00.000Z",
      "description": "Driver en route to collection"
    },
    {
      "status": "collected",
      "timestamp": "2024-01-15T14:30:00.000Z", 
      "description": "Item collected from sender"
    }
  ]
}`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        {/* Order Statuses */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Order Statuses</h2>
          
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-semibold mb-2">Pre-Collection</div>
                    <div className="space-y-1">
                      <div><Badge variant="outline">created</Badge> Order created</div>
                      <div><Badge variant="outline">sender_availability_pending</Badge> Awaiting sender availability</div>
                      <div><Badge variant="outline">receiver_availability_pending</Badge> Awaiting receiver availability</div>
                      <div><Badge variant="outline">scheduled</Badge> Collection & delivery scheduled</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold mb-2">In Transit</div>
                    <div className="space-y-1">
                      <div><Badge variant="outline">driver_to_collection</Badge> Driver en route to collection</div>
                      <div><Badge variant="outline">collected</Badge> Item collected</div>
                      <div><Badge variant="outline">driver_to_delivery</Badge> Driver en route to delivery</div>
                      <div><Badge variant="outline">delivered</Badge> Successfully delivered</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        {/* Error Responses */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Error Responses</h2>
          
          <div className="grid gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <Badge variant="destructive">400</Badge>
                    <span className="ml-2 font-semibold">Bad Request</span>
                    <pre className="bg-muted p-3 rounded text-xs mt-2">
{`{
  "error": "validation_error",
  "message": "Invalid request data",
  "details": [
    {
      "field": "sender.email",
      "message": "Invalid email format"
    }
  ]
}`}
                    </pre>
                  </div>
                  
                  <div>
                    <Badge variant="destructive">401</Badge>
                    <span className="ml-2 font-semibold">Unauthorized</span>
                    <pre className="bg-muted p-3 rounded text-xs mt-2">
{`{
  "error": "unauthorized",
  "message": "Invalid or missing API key"
}`}
                    </pre>
                  </div>

                  <div>
                    <Badge variant="destructive">429</Badge>
                    <span className="ml-2 font-semibold">Rate Limited</span>
                    <pre className="bg-muted p-3 rounded text-xs mt-2">
{`{
  "error": "rate_limit_exceeded", 
  "message": "Too many requests",
  "retryAfter": 60
}`}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Webhooks */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Webhooks
          </h2>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Webhook Events</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Receive real-time notifications when order events occur. Configure your webhook endpoint to receive POST requests.
              </p>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Available Events</h4>
                  <div className="grid gap-2 text-sm">
                    <div><Badge>order.created</Badge> New order created</div>
                    <div><Badge>order.status.updated</Badge> Order status changed</div>
                    <div><Badge>order.collection.started</Badge> Driver en route to collection</div>
                    <div><Badge>order.collection.completed</Badge> Item collected</div>
                    <div><Badge>order.delivery.started</Badge> Driver en route to delivery</div>
                    <div><Badge>order.delivery.completed</Badge> Item delivered</div>
                    <div><Badge>order.cancelled</Badge> Order cancelled</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Webhook Payload Example</h4>
                  <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{`{
  "event": "order.status.updated",
  "timestamp": "2024-01-15T14:30:00.000Z",
  "data": {
    "order": {
      "id": "ord_1234567890",
      "trackingNumber": "CC-TR-ABC123",
      "status": "collected",
      "previousStatus": "driver_to_collection",
      "updatedAt": "2024-01-15T14:30:00.000Z"
    }
  }
}`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Security</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    All webhooks include an HMAC SHA-256 signature in the <code>X-Webhook-Signature</code> header for verification.
                  </p>
                  <pre className="bg-muted p-3 rounded text-xs">
{`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return \`sha256=\${expectedSignature}\` === signature;
}`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Retry Logic</h4>
                  <p className="text-sm text-muted-foreground">
                    Failed webhooks are retried with exponential backoff: immediately, 1 minute, 5 minutes, 30 minutes, and 2 hours. 
                    Your endpoint should respond with a 2xx status code within 5 seconds.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        {/* API Key Management */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Key className="h-6 w-6" />
            API Key Management
          </h2>
          
          <Card>
            <CardHeader>
              <CardTitle>Getting API Access</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    API keys are generated exclusively by Cycle Courier administrators and are linked to your business account. 
                    All orders created via API will appear in your dashboard and be associated with your account for billing and management.
                  </AlertDescription>
                </Alert>

                <div>
                  <h4 className="font-semibold mb-2">Request Process</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Contact our API support team at <strong>api-support@cyclecourier.com</strong></li>
                    <li>Provide your business details and existing account information</li>
                    <li>Specify your intended use case and expected order volume</li>
                    <li>Include your webhook endpoint URL if you want real-time notifications</li>
                    <li>Our team will generate and securely share your API key</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Required Information</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Business name and existing Cycle Courier account email</li>
                    <li>Technical contact information</li>
                    <li>Estimated monthly order volume</li>
                    <li>Integration timeline and go-live date</li>
                    <li>Webhook endpoint URL (if applicable)</li>
                  </ul>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Security:</strong> API keys provide full access to create orders on your account. Store them securely 
                    and never expose them in client-side code. Contact support immediately if you suspect a key has been compromised.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        {/* Code Examples */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Code Examples</h2>
          
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>cURL</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{`curl -X POST https://api.cyclecourierco.com/v1/orders \\
  -H "X-API-Key: your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: unique_request_id" \\
  -d '{
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
    "bikeQuantity": 1,
    "bikes": [{"brand": "Trek", "model": "Domane AL 2"}],
    "isEbayOrder": true,
    "collectionCode": "EBAY123456"
  }'`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>JavaScript (Node.js)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{`const axios = require('axios');

async function createOrder(orderData) {
  try {
    const response = await axios.post(
      'https://api.cyclecourierco.com/v1/orders',
      orderData,
      {
        headers: {
          'X-API-Key': 'your_api_key_here',
          'Content-Type': 'application/json',
          'Idempotency-Key': \`req_\${Date.now()}\`
        }
      }
    );
    
    console.log('Order created:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating order:', error.response?.data || error.message);
    throw error;
  }
}`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Python</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{`import requests
import time

def create_order(order_data, api_key):
    headers = {
        'X-API-Key': api_key,
        'Content-Type': 'application/json',
        'Idempotency-Key': f'req_{int(time.time())}'
    }
    
    response = requests.post(
        'https://api.cyclecourierco.com/v1/orders',
        json=order_data,
        headers=headers
    )
    
    if response.status_code == 201:
        print('Order created:', response.json())
        return response.json()
    else:
        print('Error:', response.json())
        response.raise_for_status()`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Support */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Support & Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div>
                <h4 className="font-semibold mb-2">API Support</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  For technical support, API key requests, or integration assistance:
                </p>
                <p className="text-sm">
                  <strong>Email:</strong> api-support@cyclecourier.com<br />
                  <strong>Response Time:</strong> Within 24 hours on business days
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Service Status</h4>
                <p className="text-sm text-muted-foreground">
                  Monitor API availability and planned maintenance at <strong>status.cyclecourier.com</strong>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ApiDocumentationPage;