import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Copy, Play, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ApiTester = () => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastRequest, setLastRequest] = useState('');
  const [activeTab, setActiveTab] = useState('create-order');
  const { toast } = useToast();

  const baseUrl = 'https://api.cyclecourierco.com/functions/v1';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Code has been copied to your clipboard.",
    });
  };

  const testApi = async (endpoint: string, method: string, body?: any) => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your API key to test the API.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResponse('');
    
    const requestUrl = `${baseUrl}${endpoint}`;
    const requestBody = body ? JSON.stringify(body, null, 2) : undefined;
    
    setLastRequest(`${method} ${requestUrl}${requestBody ? '\n\nRequest Body:\n' + requestBody : ''}`);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
          'Idempotency-Key': `test-${Date.now()}`,
        },
      };

      if (body) {
        fetchOptions.body = JSON.stringify(body);
      }

      const res = await fetch(requestUrl, fetchOptions);
      const responseData = await res.json();
      
      const formattedResponse = {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body: responseData
      };

      setResponse(JSON.stringify(formattedResponse, null, 2));
    } catch (error) {
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const createOrderBody = {
    sender: {
      name: "John Smith",
      email: "john@example.com",
      phone: "+44 7700 900123",
      address: {
        street: "123 High Street",
        city: "London",
        state: "London",
        zipCode: "SW1A 1AA",
        country: "UK"
      }
    },
    receiver: {
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+44 7700 900456",
      address: {
        street: "456 Oak Avenue",
        city: "London",
        state: "London",
        zipCode: "E1 6AN",
        country: "UK"
      }
    },
    bikeQuantity: 1,
    bikes: [
      {
        brand: "Trek",
        model: "Domane AL 2"
      }
    ],
    customerOrderNumber: "TEST-" + Date.now(),
    needsPaymentOnCollection: false,
    isBikeSwap: false,
    isEbayOrder: false,
    deliveryInstructions: "Test order - please handle with care"
  };

  const testEndpoints = [
    {
      id: 'create-order',
      title: 'Create Order',
      method: 'POST',
      endpoint: '/orders',
      body: createOrderBody,
      description: 'Create a new courier order with test data'
    },
    {
      id: 'get-order',
      title: 'Get Order',
      method: 'GET',
      endpoint: '/orders/{order_id}',
      description: 'Retrieve order details (replace {order_id} with actual order ID)'
    }
  ];

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          API Tester
          <Badge variant="secondary">Admin Only</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This API tester is for development and testing purposes. Use your actual API key to test live endpoints.
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          {/* API Key Input */}
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Test Endpoints */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create-order">Create Order</TabsTrigger>
              <TabsTrigger value="get-order">Get Order</TabsTrigger>
            </TabsList>

            <TabsContent value="create-order" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Badge variant="default">POST</Badge>
                    /orders
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Request Body:</Label>
                      <div className="relative">
                        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-96">
                          {JSON.stringify(createOrderBody, null, 2)}
                        </pre>
                        <Button
                          size="sm"
                          variant="outline"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(JSON.stringify(createOrderBody, null, 2))}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <Button 
                      onClick={() => testApi('/orders', 'POST', createOrderBody)}
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? 'Testing...' : 'Test Create Order'}
                    </Button>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Response:</h4>
                  {response && (
                    <div className="space-y-3">
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-96 whitespace-pre-wrap">
                        {response}
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(response)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Response
                      </Button>
                    </div>
                  )}
                  {!response && !isLoading && (
                    <div className="bg-muted p-8 rounded text-center text-muted-foreground">
                      Response will appear here after testing
                    </div>
                  )}
                  {isLoading && (
                    <div className="bg-muted p-8 rounded text-center text-muted-foreground">
                      Testing API endpoint...
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="get-order" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Badge variant="secondary">GET</Badge>
                    /orders/{'{order_id}'}
                  </h4>
                  <div className="space-y-3">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        To test this endpoint, first create an order using the "Create Order" tab, then copy the order ID from the response and paste it below.
                      </AlertDescription>
                    </Alert>
                    
                    <div>
                      <Label htmlFor="order-id">Order ID:</Label>
                      <Input
                        id="order-id"
                        placeholder="Enter order ID from previous response"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            const orderId = (e.target as HTMLInputElement).value.trim();
                            if (orderId) {
                              testApi(`/orders/${orderId}`, 'GET');
                            }
                          }
                        }}
                      />
                    </div>
                    
                    <Button 
                      onClick={() => {
                        const input = document.getElementById('order-id') as HTMLInputElement;
                        const orderId = input?.value.trim();
                        if (orderId) {
                          testApi(`/orders/${orderId}`, 'GET');
                        } else {
                          toast({
                            title: "Order ID Required",
                            description: "Please enter an order ID to test this endpoint.",
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? 'Testing...' : 'Test Get Order'}
                    </Button>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Response:</h4>
                  {response && (
                    <div className="space-y-3">
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-96 whitespace-pre-wrap">
                        {response}
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(response)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Response
                      </Button>
                    </div>
                  )}
                  {!response && !isLoading && (
                    <div className="bg-muted p-8 rounded text-center text-muted-foreground">
                      Response will appear here after testing
                    </div>
                  )}
                  {isLoading && (
                    <div className="bg-muted p-8 rounded text-center text-muted-foreground">
                      Testing API endpoint...
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {lastRequest && (
            <div className="mt-6">
              <h4 className="font-semibold mb-2">Last Request:</h4>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                {lastRequest}
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiTester;