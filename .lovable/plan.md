

# Add Sentry Test Log Button

## Overview

Add a test button to verify Sentry logging is working by sending a test log using `Sentry.logger.info()`.

## Implementation

### File: `src/components/Layout.tsx`

Add a new button next to the existing "Test Sentry Error" button in the admin menu (both mobile and desktop versions).

**New button code:**
```typescript
<button 
  onClick={() => {
    const { logger } = Sentry;
    logger.info('User triggered test log', { log_source: 'sentry_test' });
    toast.success('Test log sent to Sentry');
  }}
  className="flex items-center text-amber-600 hover:text-amber-500 transition-colors"
>
  <Info className="mr-2 h-4 w-4" />
  Test Sentry Log
</button>
```

### Changes Required

| Location | Change |
|----------|--------|
| Mobile menu (line ~142-152) | Add test log button after "Test Sentry Error" button |
| Desktop dropdown (line ~290-300) | Add test log button after "Test Sentry Error" menu item |

### Additional Import

Add `Info` icon from lucide-react (already used elsewhere in the codebase).

Import `toast` from sonner for user feedback confirmation.

## Verification

1. Sign in as an admin user
2. Open the user menu dropdown (desktop) or mobile menu
3. Click "Test Sentry Log"
4. See success toast confirmation
5. Check Sentry dashboard **Logs** section for the test log with `log_source: 'sentry_test'`

