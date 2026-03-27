

## Fix: "Send All SendZen" missing some WhatsApp messages

### Problem
The `sendAllTimeslotsSendZen` function fires all edge function calls in rapid succession with **zero delay** between them (line 2530: `// NO delay for SendZen`). Each edge function call returns `{ success: true }` **immediately** before actually sending the WhatsApp message (due to `EdgeRuntime.waitUntil()` background processing). This creates two issues:

1. **Rate limiting**: SendZen's API likely throttles or drops messages when hit with 15-20+ concurrent requests
2. **False success reporting**: The frontend counts every call as successful because the edge function responds before the actual API call completes. The route report also hardcodes all results as `success: true`

### Fix

**1. `src/components/scheduling/RouteBuilder.tsx`** — Add a 500ms delay between SendZen calls

In both the grouped and standalone processing loops, add a short stagger delay:

```typescript
// After each grouped location call (~line 2488)
await new Promise(resolve => setTimeout(resolve, 500));

// After each standalone job call (~line 2529)  
await new Promise(resolve => setTimeout(resolve, 500));
```

**2. `supabase/functions/send-sendzen-whatsapp/index.ts`** — Wait for SendZen response before returning

Change the function to **await** the SendZen API call synchronously (while keeping Shipday and Email in the background). This way the frontend gets a real success/failure signal:

```typescript
// Send WhatsApp synchronously
const sendzenRes = await fetch("https://api.sendzen.io/v1/messages", { ... });
const sendzenText = await sendzenRes.text();
const sendzenSuccess = sendzenRes.ok;

// Run Shipday + Email in background
EdgeRuntime.waitUntil(Promise.allSettled([
  updateShipday(...),
  sendEmail(...),
]));

return new Response(
  JSON.stringify({ 
    success: sendzenSuccess, 
    data: { status: sendzenSuccess ? "sent" : "failed", sendzenResponse: sendzenText }
  }),
  { status: sendzenSuccess ? 200 : 502, headers: corsHeaders }
);
```

**3. `src/components/scheduling/RouteBuilder.tsx`** — Fix route report accuracy

Update the route report job results (line 2542) to track actual success/failure per job instead of hardcoding `success: true` for all.

### Summary of changes
- Add 500ms delay between SendZen calls to prevent rate limiting
- Make the edge function await the SendZen API response so failures are reported back
- Keep Shipday and email in the background (they're not user-facing)
- Track real results in the route report

