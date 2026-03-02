

## Problem

The browser sends a CORS preflight `OPTIONS` request before the actual `POST`. The `send-sendzen-whatsapp` Edge Function handles `OPTIONS` correctly and returns `Access-Control-Allow-Origin` and `Access-Control-Allow-Headers`, but it's **missing `Access-Control-Allow-Methods`**. Some browsers (especially newer versions) require this header to include `POST` in the preflight response, otherwise they block the actual request.

The direct POST works fine (just confirmed -- another review was sent to Abdullah successfully), but the browser never gets past the preflight check.

## Fix

Add `Access-Control-Allow-Methods` to the CORS headers in `supabase/functions/send-sendzen-whatsapp/index.ts`:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
```

Then redeploy the function.

## Technical Detail

- The existing `_shared/cors.ts` already includes `Access-Control-Allow-Methods: 'GET, POST, PUT, DELETE, OPTIONS'`, but `send-sendzen-whatsapp` defines its own inline CORS headers and doesn't import from the shared file.
- The POST call works when made server-to-server (no preflight), which is why the curl tests always succeed.
- The session replay confirms the user clicked "Send Review", the button changed to "Sending...", then the toast error "Failed to send a request to the Edge Function" appeared.

