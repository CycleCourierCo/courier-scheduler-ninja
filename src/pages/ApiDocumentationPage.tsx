import React from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Code, Key, Zap } from 'lucide-react';

const ApiDocumentationPage = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">API Documentation</h1>
          <p className="text-muted-foreground text-lg">
            Integrate with Cycle Courier's REST API to create and manage orders programmatically.
          </p>
        </div>

        <div className="grid gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Getting Started
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Base URL</h3>
                <code className="bg-muted px-3 py-1 rounded text-sm">
                  https://your-domain.com/api
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
            </CardContent>
          </Card>

          <Card>
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
                  <code className="text-sm">/v1/orders</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Create a new courier order with sender, receiver, and bike details.
                </p>
                <div>
                  <h4 className="font-semibold mb-2">Example Request</h4>
                  <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{`{
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
}`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Request API Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                To get started with our API, you'll need an API key. Contact our support team to request access.
              </p>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Email:</strong> api-support@cyclecourier.com
                </p>
                <p className="text-sm">
                  <strong>Include:</strong> Your business name, use case, and expected volume
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-muted rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Complete Documentation</h2>
          <p className="text-muted-foreground mb-4">
            For detailed API reference, examples, and webhook documentation, visit our complete developer documentation.
          </p>
          <div className="flex gap-4">
            <a 
              href="/docs/api" 
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Full API Reference
            </a>
            <a 
              href="/docs/webhooks" 
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Webhook Documentation
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ApiDocumentationPage;