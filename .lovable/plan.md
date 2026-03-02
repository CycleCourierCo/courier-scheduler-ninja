

## Problem

The `send-sendzen-whatsapp` Edge Function **is actually working** - the logs confirm reviews are being sent successfully. However, the SendZen API call takes several seconds, and the Supabase JS client's `functions.invoke()` has a default timeout. When the total time (OPTIONS cold boot + POST cold boot + Supabase DB query + SendZen API call) exceeds this timeout, the client throws a "Failed to send a request to the Edge Function" error, even though the function completes successfully in the background.

## Fix

Restructure the Edge Function to **return immediately** after validating the request and fetching the order, then process the SendZen API call in the background using `EdgeRuntime.waitUntil()`.

### Changes to `supabase/functions/send-sendzen-whatsapp/index.ts`

1. After fetching the order and building the SendZen request body, return a success response immediately
2. Move the actual `fetch("https://api.sendzen.io/...")` call into `EdgeRuntime.waitUntil()` so it runs in the background
3. This ensures the client gets a response within ~1-2 seconds instead of waiting for the full SendZen round-trip

```typescript
// Build sendzenBody as before...

// Return immediately
EdgeRuntime.waitUntil(
  fetch("https://api.sendzen.io/v1/messages", {
    method: "POST",
    headers: { ... },
    body: JSON.stringify(sendzenBody),
  }).then(res => {
    console.log("SendZen background send complete:", res.status);
  }).catch(err => {
    console.error("SendZen background send failed:", err);
  })
);

return new Response(
  JSON.stringify({ success: true, data: { status: "queued" } }),
  { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

### Also apply the same pattern to `TimeslotSelection.tsx`'s SendZen handler

No client-side changes needed - the existing code already handles `data?.success` which will still be `true`.

