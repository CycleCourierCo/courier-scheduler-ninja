

# Fix Sentry Error Capture

## Problem Identified

There are **two issues** preventing Sentry from receiving events:

### Issue 1: DSN Mismatch
The DSN stored in your `VITE_SENTRY_DSN` secret might not match the one from your Sentry setup instructions. 

- **Your setup instructions show**: `https://04d51685aa182c5a5f8655bb134e8821@o4510751261130752.ingest.de.sentry.io/4510751293898832`
- **Previously configured**: `https://ad71dbb0ad62ea54873b39aa66adb52f@o4510751261130752.ingest.de.sentry.io/4510751278301264`

**Action Required**: Update the `VITE_SENTRY_DSN` secret in Project Settings with the correct DSN from your Sentry dashboard.

### Issue 2: Event Handler Errors Not Captured

Errors thrown in React event handlers (like `onClick`) do **NOT** automatically get captured by:
- React ErrorBoundary (only catches render errors)
- Sentry's global error handler

The error happens but Sentry never sees it because it's caught by React's synthetic event system.

## Solution

Modify the test button to explicitly capture the error using `Sentry.captureException()`:

### File to Modify

| File | Changes |
|------|---------|
| `src/components/Layout.tsx` | Use `Sentry.captureException()` instead of just throwing |

### Code Changes

Update both test buttons (mobile and desktop) from:

```tsx
onClick={() => {
  throw new Error('Sentry Test Error - Triggered by admin');
}}
```

To:

```tsx
onClick={() => {
  const error = new Error('Sentry Test Error - Triggered by admin');
  Sentry.captureException(error);
  throw error; // Still throw to show ErrorFallback UI
}}
```

This ensures:
1. The error is explicitly sent to Sentry via `captureException()`
2. The error still throws to trigger the ErrorBoundary UI feedback

### Additional Import

Add Sentry import at the top of Layout.tsx:

```tsx
import * as Sentry from "@sentry/react";
```

## Verification Steps

After implementing:

1. **Update the DSN secret** in Project Settings → Secrets with your correct DSN
2. Click "Test Sentry Error" button
3. Check Sentry dashboard - event should appear within seconds
4. The ErrorFallback component will also display in the app

