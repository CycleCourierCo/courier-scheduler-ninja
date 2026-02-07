

# Enable Sentry Logs

## Current State

The Sentry configuration in `src/main.tsx` currently has:
- Browser tracing integration
- Session replay integration
- Distributed tracing targets

But it's **missing** the logging configuration.

## Changes Required

### File: `src/main.tsx`

Update the Sentry initialization to enable logs:

```typescript
Sentry.init({
  dsn: sentryDsn,
  environment: import.meta.env.PROD ? "production" : "preview",
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
    // NEW: Send console logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enabled: !!sentryDsn,
  // NEW: Enable logs to be sent to Sentry
  enableLogs: true,
  // Distributed tracing targets
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/axigtrmaxhetyfzjjdve\.supabase\.co/,
    /^https:\/\/api\.geoapify\.com/,
  ],
});
```

## What This Enables

| Feature | Description |
|---------|-------------|
| `enableLogs: true` | Activates Sentry's logging infrastructure |
| `consoleLoggingIntegration` | Automatically captures `console.log`, `console.warn`, and `console.error` calls and sends them to Sentry |

## After Implementation

1. All `console.log`, `console.warn`, and `console.error` calls will appear in Sentry
2. You can view logs in Sentry under the **Logs** section
3. Logs will be correlated with errors and traces for better debugging context

