import React from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Code, Key, Zap, Globe, Shield, Bell, AlertTriangle, CheckCircle, Info, Plug, Download } from 'lucide-react';
import partnerGuideMarkdown from '../../docs/PARTNER_API_INTEGRATION.md?raw';

// Lets staff hand partners a self-contained copy of the integration guide.
const downloadPartnerGuide = () => {
  const blob = new Blob([partnerGuideMarkdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Cycle-Courier-Partner-Integration-Guide.md';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const ApiDocumentationPage = () => {
  return <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-primary mb-2">API Documentation</h1>
          <p className="text-muted-foreground text-base md:text-lg">
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
                <code className="bg-muted px-3 py-1 rounded text-sm break-all">
                  https://api.cyclecourierco.com/functions/v1
                </code>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Authentication</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Every request needs either an API key:
                </p>
                <code className="bg-muted px-3 py-1 rounded text-sm block break-all">
                  X-API-Key: your_api_key_here
                </code>
                <p className="text-sm text-muted-foreground mt-2 mb-2">
                  ...or an OAuth access token, if you are a partner app acting for a customer:
                </p>
                <code className="bg-muted px-3 py-1 rounded text-sm block break-all">
                  Authorization: Bearer access_token_here
                </code>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Connect with Cycle Courier (partner apps)</h3>
                <p className="text-sm text-muted-foreground">
                  Partner apps use OAuth 2.1 with PKCE so customers can connect their own Cycle
                  Courier account — no API key copying. See the full{" "}
                  <a href="#partner-integration" className="text-primary underline">
                    Partner Integration guide
                  </a>{" "}
                  below.
                </p>
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

          {/* Partner Integration (OAuth 2.1) */}
          <Card id="partner-integration">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Plug className="h-5 w-5" />
                  Partner Integration — "Connect with Cycle Courier" (OAuth 2.1)
                </CardTitle>
                <Button variant="outline" size="sm" onClick={downloadPartnerGuide}>
                  <Download className="h-4 w-4 mr-2" />
                  Download partner guide
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <p className="text-muted-foreground">
                This section is written for partner platforms (for example a dealer or marketplace
                system). It lets a Cycle Courier customer approve your product once, after which you
                can create and read that customer's orders without them copying an API key.
              </p>

              <div>
                <h3 className="font-semibold mb-2">1. Getting started</h3>
                <p className="text-muted-foreground mb-2">Cycle Courier registers your app and gives you:</p>
                <ul className="text-muted-foreground list-disc pl-5 space-y-1 mb-2">
                  <li><code className="bg-muted px-1 rounded">client_id</code> (App ID) — safe to put in URLs.</li>
                  <li><code className="bg-muted px-1 rounded">client_secret</code> (App secret) — shown once, server-side only.</li>
                </ul>
                <p className="text-muted-foreground mb-2">You give us:</p>
                <ul className="text-muted-foreground list-disc pl-5 space-y-1">
                  <li>Your exact return web address(es). HTTPS only, except <code className="bg-muted px-1 rounded">http://localhost</code> for development.</li>
                  <li>A technical contact email.</li>
                </ul>
                <p className="text-muted-foreground mt-2">
                  Return addresses are matched exactly, including trailing slashes. Register every
                  environment you need (production, staging, local).
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">2. The connect flow</h3>
                <code className="bg-muted px-3 py-2 rounded text-xs block whitespace-pre-wrap break-all mb-3">
{`Your app     ──▶ /oauth/authorize   (customer signs in and approves)
             ◀── redirect back with ?code=...&state=...
Your server  ──▶ POST /oauth-token   (code + code_verifier + secret)
             ◀── access_token (1 hour) + refresh_token (180 days)
Your server  ──▶ Cycle Courier API   Authorization: Bearer <access_token>`}
                </code>

                <h4 className="font-medium mb-1">Step 1 — send the customer to the approval page</h4>
                <code className="bg-muted px-3 py-2 rounded text-xs block whitespace-pre-wrap break-all mb-2">
{`https://booking.cyclecourierco.com/oauth/authorize
  ?response_type=code
  &client_id=APP_ID
  &redirect_uri=YOUR_RETURN_URL
  &state=RANDOM
  &code_challenge=CHALLENGE
  &code_challenge_method=S256`}
                </code>
                <div className="overflow-x-auto mb-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-1 pr-3 font-medium">Parameter</th>
                        <th className="py-1 pr-3 font-medium">Required</th>
                        <th className="py-1 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b"><td className="py-1 pr-3"><code>response_type</code></td><td className="py-1 pr-3">Yes</td><td className="py-1">Always <code>code</code></td></tr>
                      <tr className="border-b"><td className="py-1 pr-3"><code>client_id</code></td><td className="py-1 pr-3">Yes</td><td className="py-1">Your App ID</td></tr>
                      <tr className="border-b"><td className="py-1 pr-3"><code>redirect_uri</code></td><td className="py-1 pr-3">Yes</td><td className="py-1">Must exactly match a registered address</td></tr>
                      <tr className="border-b"><td className="py-1 pr-3"><code>state</code></td><td className="py-1 pr-3">Yes</td><td className="py-1">Opaque value returned to you — always verify it</td></tr>
                      <tr className="border-b"><td className="py-1 pr-3"><code>code_challenge</code></td><td className="py-1 pr-3">Yes</td><td className="py-1">base64url SHA-256 of your verifier (32–200 chars)</td></tr>
                      <tr><td className="py-1 pr-3"><code>code_challenge_method</code></td><td className="py-1 pr-3">Yes</td><td className="py-1"><code>S256</code></td></tr>
                    </tbody>
                  </table>
                </div>
                <code className="bg-muted px-3 py-2 rounded text-xs block whitespace-pre-wrap break-all mb-3">
{`// generating PKCE values (Node.js)
const b64url = (buf) => buf.toString("base64url");
const codeVerifier = b64url(crypto.randomBytes(32));  // keep in the user's session
const codeChallenge = b64url(crypto.createHash("sha256").update(codeVerifier).digest());`}
                </code>
                <p className="text-muted-foreground mb-3">
                  If the customer is not signed in they sign in first and are returned to the approval
                  screen automatically. The screen shows your app name and the account being connected.
                </p>

                <h4 className="font-medium mb-1">Step 2 — handle the redirect back</h4>
                <code className="bg-muted px-3 py-2 rounded text-xs block whitespace-pre-wrap break-all mb-2">
{`https://your-app.example.com/callback?code=ccode_xxx&state=THE_STATE_YOU_SENT
// cancelled by the customer:
https://your-app.example.com/callback?error=access_denied&state=...`}
                </code>
                <p className="text-muted-foreground mb-3">
                  Verify <code className="bg-muted px-1 rounded">state</code>. Codes are single-use and
                  expire after 60 seconds.
                </p>

                <h4 className="font-medium mb-1">Step 3 — exchange the code for tokens</h4>
                <code className="bg-muted px-3 py-2 rounded text-xs block whitespace-pre-wrap break-all mb-2">
{`POST https://api.cyclecourierco.com/functions/v1/oauth-token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=ccode_xxx&redirect_uri=YOUR_RETURN_URL
&code_verifier=THE_VERIFIER&client_id=APP_ID&client_secret=APP_SECRET

// response
{
  "access_token": "ccat_...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "ccrt_...",
  "scope": "api"
}`}
                </code>
                <p className="text-muted-foreground">
                  Credentials may also be sent as HTTP Basic auth, and JSON bodies are accepted as
                  well as form encoding.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">3. Tokens</h3>
                <ul className="text-muted-foreground list-disc pl-5 space-y-1 mb-2">
                  <li>Access tokens last 1 hour.</li>
                  <li>Refresh tokens last 180 days and <strong>rotate on every use</strong> — store the new one immediately and never refresh the same token twice in parallel.</li>
                  <li>Reusing an already-rotated refresh token revokes the whole connection; the customer must reconnect.</li>
                  <li>Store tokens encrypted, per customer, server-side only.</li>
                </ul>
                <code className="bg-muted px-3 py-2 rounded text-xs block whitespace-pre-wrap break-all mb-2">
{`POST https://api.cyclecourierco.com/functions/v1/oauth-token
grant_type=refresh_token&refresh_token=ccrt_...&client_id=APP_ID&client_secret=APP_SECRET`}
                </code>
                <p className="text-muted-foreground">
                  A refresh that returns <code className="bg-muted px-1 rounded">invalid_grant</code>{" "}
                  means the connection is gone (revoked, app disabled, or token expired or reused).
                  Stop retrying, mark the customer as disconnected and prompt them to reconnect.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">4. Calling the API for a customer</h3>
                <p className="text-muted-foreground mb-2">
                  Use the same endpoints documented below for API keys — only the auth header changes.
                  An access token grants exactly the same access as that customer's own API key, and
                  orders you create appear in their dashboard.
                </p>
                <code className="bg-muted px-3 py-2 rounded text-xs block whitespace-pre-wrap break-all">
{`curl -X POST https://api.cyclecourierco.com/functions/v1/orders \\
  -H "Authorization: Bearer ccat_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "sender": { }, "receiver": { }, "bikes": [ ] }'`}
                </code>
              </div>

              <div>
                <h3 className="font-semibold mb-2">5. Disconnecting</h3>
                <code className="bg-muted px-3 py-2 rounded text-xs block whitespace-pre-wrap break-all mb-2">
{`POST https://api.cyclecourierco.com/functions/v1/oauth-revoke
token=ACCESS_OR_REFRESH_TOKEN&client_id=APP_ID&client_secret=APP_SECRET`}
                </code>
                <p className="text-muted-foreground">
                  Revoking a refresh token ends the whole connection; revoking an access token ends
                  just that token. Unknown or already-revoked tokens return success. Customers can
                  also disconnect your app from their profile, and Cycle Courier can disable an app
                  entirely — both take effect immediately, so always handle 401 gracefully.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">6. Errors</h3>
                <div className="overflow-x-auto mb-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-1 pr-3 font-medium">Approval endpoint</th>
                        <th className="py-1 font-medium">Meaning / fix</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b"><td className="py-1 pr-3"><code>unauthorized_client</code></td><td className="py-1">Unknown App ID, or the app has been disabled</td></tr>
                      <tr className="border-b"><td className="py-1 pr-3"><code>invalid_redirect_uri</code></td><td className="py-1">Return address not registered or not an exact match</td></tr>
                      <tr className="border-b"><td className="py-1 pr-3"><code>invalid_request</code></td><td className="py-1">Missing parameter, or challenge not 32–200 characters</td></tr>
                      <tr className="border-b"><td className="py-1 pr-3"><code>login_required</code> (401)</td><td className="py-1">No signed-in customer session</td></tr>
                      <tr><td className="py-1 pr-3"><code>access_denied</code></td><td className="py-1">Customer pressed Cancel</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="overflow-x-auto mb-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-1 pr-3 font-medium">Token endpoint</th>
                        <th className="py-1 pr-3 font-medium">HTTP</th>
                        <th className="py-1 font-medium">Meaning / fix</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b"><td className="py-1 pr-3"><code>invalid_client</code></td><td className="py-1 pr-3">401</td><td className="py-1">Wrong App ID or secret, or app disabled</td></tr>
                      <tr className="border-b"><td className="py-1 pr-3"><code>invalid_request</code></td><td className="py-1 pr-3">400</td><td className="py-1">Missing code, verifier or return address, or unparseable body</td></tr>
                      <tr className="border-b"><td className="py-1 pr-3"><code>invalid_grant</code></td><td className="py-1 pr-3">400</td><td className="py-1">Code expired (60s), already used, wrong return address, failed PKCE check, or refresh token expired / revoked / reused</td></tr>
                      <tr className="border-b"><td className="py-1 pr-3"><code>unsupported_grant_type</code></td><td className="py-1 pr-3">400</td><td className="py-1">Only <code>authorization_code</code> and <code>refresh_token</code> are supported</td></tr>
                      <tr className="border-b"><td className="py-1 pr-3"><code>slow_down</code></td><td className="py-1 pr-3">429</td><td className="py-1">Too many token requests — back off and retry</td></tr>
                      <tr><td className="py-1 pr-3"><code>server_error</code></td><td className="py-1 pr-3">500</td><td className="py-1">Transient — retry with backoff</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-1 pr-3 font-medium">API requests</th>
                        <th className="py-1 pr-3 font-medium">HTTP</th>
                        <th className="py-1 font-medium">Meaning</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b"><td className="py-1 pr-3"><code>MISSING_API_KEY</code></td><td className="py-1 pr-3">401</td><td className="py-1">No <code>Authorization</code> or <code>X-API-Key</code> header</td></tr>
                      <tr><td className="py-1 pr-3"><code>INVALID_TOKEN</code></td><td className="py-1 pr-3">401</td><td className="py-1">Access token expired or revoked — refresh, then reconnect if that fails</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">7. Checklist before going live</h3>
                <ul className="text-muted-foreground list-disc pl-5 space-y-1">
                  <li>App secret stored server-side only — never in a browser or mobile app.</li>
                  <li><code className="bg-muted px-1 rounded">state</code> generated per attempt and verified on return.</li>
                  <li><code className="bg-muted px-1 rounded">code_verifier</code> kept in the user's session, never in a URL.</li>
                  <li>Rotated refresh token persisted on every refresh.</li>
                  <li>One connection stored per Cycle Courier customer.</li>
                  <li>401 / <code className="bg-muted px-1 rounded">invalid_grant</code> triggers a reconnect prompt, not a retry loop.</li>
                  <li>Production and staging return addresses both registered.</li>
                  <li>Full connect, order create, refresh and disconnect tested end to end.</li>
                </ul>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Need an App ID, a new return address or a replacement secret? Email{" "}
                  <strong>Info@cyclecourierco.com</strong> with your App ID — never your secret.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        {/* Orders API */}
        <div className="mb-8">
          <h2 className="text-xl md:text-2xl font-bold mb-6">Orders API</h2>
          
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
                  <pre className="bg-muted p-3 rounded text-sm whitespace-pre-wrap break-words">
                  {`X-API-Key: your_api_key_here
Content-Type: application/json
Idempotency-Key: unique_request_id (optional)`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Request Body</h4>
                  <pre className="bg-muted p-4 rounded text-sm whitespace-pre-wrap break-words leading-relaxed">
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
      "model": "Domane AL 2",
      "type_id": 2,
      "value": 1200
    }
  ],
  "bike_type_id": 2,
  "bike_value": 1200,
  "customerOrderNumber": "ORD-12345",
  "needsPaymentOnCollection": false,
  "paymentCollectionPhone": "+44 7700 900789",
  "isBikeSwap": false,
  "isEbayOrder": true,
  "collectionCode": "EBAY123456",
  "needsInspection": true,
  "isBoxMyBike": false,
  "deliveryInstructions": "Please ring doorbell and wait"
}`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Field Descriptions</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>bikeQuantity:</strong> <em>(required)</em> Number of bikes being transported</div>
                    <div><strong>bikes:</strong> <em>(required)</em> Array of bike details with brand and model</div>
                    <div><strong>bikes[].type_id:</strong> <em>(optional)</em> Numeric bike type ID (1-17, see reference table below; takes precedence over type)</div>
                    <div><strong>bikes[].type:</strong> <em>(optional)</em> String bike type name (e.g. "Non-Electric - Road Bike")</div>
                    <div><strong>bikes[].value:</strong> <em>(optional)</em> Estimated value per bike in £</div>
                    <div><strong>bike_type_id:</strong> <em>(optional)</em> Top-level numeric bike type ID (1-17); takes precedence over bike_type</div>
                    <div><strong>bike_type:</strong> <em>(optional)</em> Top-level string bike type name</div>
                    <div><strong>bike_value:</strong> <em>(optional)</em> Top-level estimated bike value in £</div>
                    <div><strong>customerOrderNumber:</strong> <em>(optional)</em> Your internal order reference (stored but not returned in response)</div>
                    <div><strong>needsPaymentOnCollection:</strong> <em>(optional)</em> Whether payment is required on collection</div>
                    <div><strong>paymentCollectionPhone:</strong> <em>(optional)</em> Phone number for payment collection</div>
                    <div><strong>isBikeSwap:</strong> <em>(optional)</em> Whether this is a bike exchange/swap</div>
                    <div><strong>isEbayOrder:</strong> <em>(optional)</em> Whether this is an eBay order</div>
                    <div><strong>collectionCode:</strong> <em>(optional)</em> eBay collection code or similar reference</div>
                    <div><strong>needsInspection:</strong> <em>(optional)</em> Whether the bicycle requires inspection before delivery</div>
                    <div><strong>isBoxMyBike:</strong> <em>(optional)</em> Boxing service for international shipping. When true, the <code>receiver</code> field is optional and will be auto-filled with the Cycle Courier depot. You must arrange a 3rd-party courier and upload the shipping label once the bike is boxed.</div>
                    <div><strong>boxBuyer:</strong> <em>(optional, Box My Bike only)</em> The end buyer the boxed bike is going to, as <code>{`{ "name": "...", "email": "...", "phone": "..." }`}</code>. Since the receiver becomes our depot, this is who receives boxing and courier-collection updates.</div>
                    <div><strong>deliveryInstructions:</strong> <em>(optional)</em> Special delivery instructions</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Success Response (201 Created)</h4>
                  <pre className="bg-muted p-4 rounded text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {`{
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
  "is_ebay_order": true,
  "collection_code": "EBAY123456",
  "needs_payment_on_collection": false,
  "needs_inspection": true,
  "delivery_instructions": "Please ring doorbell and wait"
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
                  <p className="text-sm text-muted-foreground mb-2">
                    Returns the full order record including additional fields like <code>customer_order_number</code> and <code>updated_at</code>.
                  </p>
                  <pre className="bg-muted p-4 rounded text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {`{
  "id": "ord_1234567890",
  "tracking_number": "CC-TR-ABC123",
  "status": "collected",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T14:30:00.000Z",
  "customer_order_number": "ORD-12345",
  "sender": { ... },
  "receiver": { ... },
  "bike_brand": "Trek",
  "bike_model": "Domane AL 2",
  "bike_quantity": 1,
  "is_bike_swap": false,
  "is_ebay_order": true,
  "collection_code": "EBAY123456",
  "needs_payment_on_collection": false,
  "needs_inspection": true,
  "delivery_instructions": "Please ring doorbell and wait"
}`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        {/* Bike Type Reference */}
        <div className="mb-8">
          <h2 className="text-xl md:text-2xl font-bold mb-6">Bike Type Reference</h2>
          
          <Card>
            <CardHeader>
              <CardTitle>Numeric Type IDs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Use <code>bike_type_id</code> or <code>type_id</code> (per bike) for reliable type specification. Numeric IDs take precedence over string names.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-semibold">ID</th>
                      <th className="text-left py-2 px-3 font-semibold">Bike Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: 1, name: 'Non-Electric - Mountain Bike' },
                      { id: 2, name: 'Non-Electric - Road Bike' },
                      { id: 3, name: 'Non-Electric - Hybrid' },
                      { id: 4, name: 'Electric Bike - Under 25kg' },
                      { id: 5, name: 'Electric Bike - Over 25kg' },
                      { id: 6, name: 'Cargo Bike' },
                      { id: 7, name: 'Longtail Cargo Bike' },
                      { id: 8, name: 'Stationary Bike' },
                      { id: 9, name: 'Kids Bikes' },
                      { id: 10, name: 'BMX Bikes' },
                      { id: 11, name: 'Boxed Kids Bikes' },
                      { id: 12, name: 'Folding Bikes' },
                      { id: 13, name: 'Tandem' },
                      { id: 14, name: 'Travel Bike Box' },
                      { id: 15, name: 'Wheelset/Frameset' },
                      { id: 16, name: 'Bike Rack' },
                      { id: 17, name: 'Turbo Trainer' },
                    ].map((bike) => (
                      <tr key={bike.id} className="border-b last:border-0">
                        <td className="py-2 px-3 font-mono">{bike.id}</td>
                        <td className="py-2 px-3">{bike.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        {/* Order Statuses */}
        <div className="mb-8">
          <h2 className="text-xl md:text-2xl font-bold mb-6">Order Statuses</h2>
          
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
          <h2 className="text-xl md:text-2xl font-bold mb-6">Error Responses</h2>
          
          <div className="grid gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <Badge variant="destructive">400</Badge>
                    <span className="ml-2 font-semibold">Bad Request</span>
                    <pre className="bg-muted p-3 rounded text-sm whitespace-pre-wrap break-words leading-relaxed mt-2">
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
                    <pre className="bg-muted p-3 rounded text-sm whitespace-pre-wrap break-words leading-relaxed mt-2">
                    {`{
  "error": "unauthorized",
  "message": "Invalid or missing API key"
}`}
                    </pre>
                  </div>

                  <div>
                    <Badge variant="destructive">429</Badge>
                    <span className="ml-2 font-semibold">Rate Limited</span>
                    <pre className="bg-muted p-3 rounded text-sm whitespace-pre-wrap break-words leading-relaxed mt-2">
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
          <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center gap-2">
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
                    <div><Badge>order.box.status.updated</Badge> Box My Bike status changed (generic)</div>
                    <div><Badge>order.box.in_depot</Badge> Bike arrived at depot, awaiting boxing</div>
                    <div><Badge>order.box.boxed</Badge> Bike boxed, awaiting shipping label</div>
                    <div><Badge>order.box.label_uploaded</Badge> 3rd-party shipping label uploaded</div>
                    <div><Badge>order.box.collected_by_3p</Badge> Boxed bike collected by 3rd-party courier</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Webhook Payload Example</h4>
                  <pre className="bg-muted p-4 rounded text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {`{
  "event": "order.status.updated",
  "timestamp": "2024-01-15T14:30:00.000Z",
  "data": {
    "order": {
      "id": "ord_1234567890",
      "tracking_number": "CC-TR-ABC123",
      "status": "collected",
      "previous_status": "driver_to_collection",
      "updated_at": "2024-01-15T14:30:00.000Z"
    }
  }
}`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Box My Bike Payload Example</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    When the order has <code>is_box_my_bike: true</code>, Box My Bike events include additional fields tracking the boxing lifecycle.
                  </p>
                  <pre className="bg-muted p-4 rounded text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {`{
  "event": "order.box.status.updated",
  "timestamp": "2026-06-06T11:00:00.000Z",
  "data": {
    "id": "a3ae471c-4a93-44cd-b664-4db4aeeec70c",
    "tracking_number": "CCC754773995458CHRCH6",
    "status": "collected",
    "is_box_my_bike": true,
    "box_my_bike_status": "boxed_awaiting_label",
    "previous_status": "in_depot_awaiting_boxing",
    "new_status": "boxed_awaiting_label",
    "box_label_url": null,
    "box_in_depot_at": "2026-06-05T09:12:00.000Z",
    "box_boxed_at": "2026-06-06T11:00:00.000Z",
    "box_label_printed_at": null,
    "box_collected_by_3p_at": null
  }
}`}
                  </pre>
                </div>


                <div>
                  <h4 className="font-semibold mb-2">Security</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    All webhooks include an HMAC SHA-256 signature in the <code>X-Webhook-Signature</code> header for verification.
                  </p>
                  <pre className="bg-muted p-3 rounded text-sm whitespace-pre-wrap break-words leading-relaxed">
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
          <h2 className="text-xl md:text-2xl font-bold mb-6 flex items-center gap-2">
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
                    <li>Contact our API support team at <strong>info@cyclecourierco.com</strong></li>
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
          <h2 className="text-xl md:text-2xl font-bold mb-6">Code Examples</h2>
          
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>cURL</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded text-sm whitespace-pre-wrap break-words leading-relaxed">
                {`curl -X POST https://api.cyclecourierco.com/functions/v1/orders \\
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
                <pre className="bg-muted p-4 rounded text-sm whitespace-pre-wrap break-words leading-relaxed">
                {`const axios = require('axios');

async function createOrder(orderData) {
  try {
    const response = await axios.post(
      'https://api.cyclecourierco.com/functions/v1/orders',
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
                <pre className="bg-muted p-4 rounded text-sm whitespace-pre-wrap break-words leading-relaxed">
                {`import requests
import time

def create_order(order_data, api_key):
    headers = {
        'X-API-Key': api_key,
        'Content-Type': 'application/json',
        'Idempotency-Key': f'req_{int(time.time())}'
    }
    
    response = requests.post(
        'https://api.cyclecourierco.com/functions/v1/orders',
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
                  <strong>Email:</strong> info@cyclecourierco.com
                </p>
              </div>
              
              
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>;
};
export default ApiDocumentationPage;