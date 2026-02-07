

# Add Distributed Tracing - Frontend and Edge Functions

## Overview

This plan adds distributed tracing configuration to both the frontend React application and the Supabase Edge Functions, enabling end-to-end visibility of requests through Sentry.

---

## Part 1: Frontend Tracing Configuration

### File: `src/main.tsx`

Add `tracePropagationTargets` to the Sentry initialization to ensure tracing headers are sent with requests to your backend services.

```typescript
Sentry.init({
  dsn: sentryDsn,
  environment: import.meta.env.PROD ? "production" : "preview",
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enabled: !!sentryDsn,
  // NEW: Add distributed tracing targets
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/axigtrmaxhetyfzjjdve\.supabase\.co/,
    /^https:\/\/api\.geoapify\.com/,
  ],
});
```

---

## Part 2: Edge Functions Sentry Integration

### Secret Required

A new secret `SENTRY_DSN` needs to be added to the Edge Functions environment with value:
```
https://04d51685aa182c5a5f8655bb134e8821@o4510751261130752.ingest.de.sentry.io/4510751293898832
```

### New Shared Module: `supabase/functions/_shared/sentry.ts`

Create a shared Sentry utility module for all Edge Functions:

```typescript
import * as Sentry from "https://deno.land/x/sentry@8.45.0/index.mjs";

const SENTRY_DSN = Deno.env.get("SENTRY_DSN");

// Initialize Sentry for Edge Functions
export function initSentry(functionName: string) {
  if (!SENTRY_DSN) {
    console.log("SENTRY_DSN not set, Sentry disabled");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: "edge-function",
    tracesSampleRate: 0.1,
    integrations: [],
  });

  Sentry.setTag("function_name", functionName);
}

// Capture exceptions with context
export function captureException(error: Error, context?: Record<string, any>) {
  if (!SENTRY_DSN) return;
  
  if (context) {
    Sentry.setContext("additional", context);
  }
  Sentry.captureException(error);
}

// Wrap async handler with error tracking
export function withSentry<T>(
  functionName: string,
  handler: () => Promise<T>
): Promise<T> {
  initSentry(functionName);
  
  return Sentry.startSpan(
    { op: "edge-function", name: functionName },
    async () => {
      try {
        return await handler();
      } catch (error) {
        captureException(error as Error);
        throw error;
      }
    }
  );
}

export { Sentry };
```

### Edge Function Updates

Update key edge functions to use Sentry. Example for `orders/index.ts`:

```typescript
import { initSentry, captureException, Sentry } from '../_shared/sentry.ts';

// At the start of Deno.serve
Deno.serve(async (req) => {
  initSentry("orders");
  
  // Wrap main logic in a span
  return Sentry.startSpan(
    { op: "http.server", name: `${req.method} /orders` },
    async () => {
      try {
        // ... existing code ...
      } catch (error) {
        captureException(error as Error, { 
          method: req.method,
          url: req.url 
        });
        throw error;
      }
    }
  );
});
```

---

## Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `src/main.tsx` | Modify | Add `tracePropagationTargets` array |
| `supabase/functions/_shared/sentry.ts` | Create | Shared Sentry utilities for edge functions |
| `supabase/functions/orders/index.ts` | Modify | Add Sentry error tracking and spans |
| `supabase/functions/send-email/index.ts` | Modify | Add Sentry error tracking |
| `supabase/functions/create-shipday-order/index.ts` | Modify | Add Sentry error tracking |
| `supabase/functions/shipday-webhook/index.ts` | Modify | Add Sentry error tracking |

---

## Priority Order

1. **High-traffic/critical functions** (add first):
   - `orders` - Main API endpoint
   - `send-email` - Email delivery
   - `shipday-webhook` - External webhook handler
   - `create-shipday-order` - External API integration

2. **Secondary functions** (add later if needed):
   - `trigger-webhook`
   - `create-quickbooks-invoice`
   - `generate-tracking-numbers`

---

## Tracing Flow

```text
Browser Request
     |
     v
[Frontend Span: "API Call"]
     | (sentry-trace header)
     v
[Edge Function Span: "orders"]
     |
     +---> [Child Span: "geocode-sender"]
     |
     +---> [Child Span: "geocode-receiver"]
     |
     +---> [Child Span: "create-order-db"]
     |
     +---> [Child Span: "send-email"]
```

---

## Verification

After implementation:

1. Check Sentry **Performance** tab for traces
2. Verify traces show connected spans from browser to edge functions
3. Test error capture by triggering validation errors
4. Check edge function logs for Sentry initialization messages

