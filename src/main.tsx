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
  // Distributed tracing targets - headers sent to these endpoints
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/axigtrmaxhetyfzjjdve\.supabase\.co/,
    /^https:\/\/api\.geoapify\.com/,
  ],
});

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason);
});

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
