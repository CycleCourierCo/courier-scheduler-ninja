import * as Sentry from "@sentry/react";
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Initialize Sentry before rendering
// Enable if DSN is configured (works in both dev preview and production)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

Sentry.init({
  dsn: sentryDsn,
  environment: import.meta.env.PROD ? "production" : "preview",
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
    // Send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enabled: !!sentryDsn,
  // Enable logs to be sent to Sentry
  enableLogs: true,
  // Form validation failures are expected user behaviour, not application faults
  ignoreErrors: [/ZodError/],
  // Distributed tracing targets - headers sent to these endpoints
  // Note: Geoapify excluded because their CORS policy doesn't allow sentry-trace header
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/api\.cyclecourierco\.com/,
    /^https:\/\/axigtrmaxhetyfzjjdve\.supabase\.co/,
  ],
});

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as { name?: string } | undefined;
  // Skip form validation errors — these are normal "fill this field in" results
  if (reason?.name === 'ZodError') return;
  Sentry.captureException(event.reason);
});


createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
