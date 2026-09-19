import * as Sentry from "@sentry/react";
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { supabase } from '@/integrations/supabase/client';

// Initialize Sentry before rendering
// Enable if DSN is configured (works in both dev preview and production)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

// Wrapped: if a blocker or privacy extension breaks the Sentry SDK, the app
// must still start. Reporting is never worth a blank page.
try {
Sentry.init({
  dsn: sentryDsn,
  environment: import.meta.env.PROD ? "production" : "preview",
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
    // Only forward warnings and errors: routine console.log output on data-heavy
    // pages produced thousands of events and blocked the UI thread.
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
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
} catch {
  // Error reporting unavailable (blocked script/storage) — carry on.
}

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as { name?: string } | undefined;
  // Skip form validation errors — these are normal "fill this field in" results
  if (reason?.name === 'ZodError') return;
  try {
    Sentry.captureException(event.reason);
  } catch {
    /* reporting blocked */
  }
});


const RELEASE_RESET_ID = "2026-09-19-brand-refresh";
const RELEASE_RESET_KEY = `ccc-release-reset:${RELEASE_RESET_ID}`;
const RELEASE_RESET_PARAM = "ccc-release";

const renderApp = () => {
  const root = document.getElementById("root");
  if (!root) return;

  createRoot(root).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};

const runOneTimeReleaseReset = async () => {
  const url = new URL(window.location.href);
  const returnedFromReset = url.searchParams.get(RELEASE_RESET_PARAM) === RELEASE_RESET_ID;
  let resetComplete = returnedFromReset;

  try {
    resetComplete = resetComplete || window.localStorage.getItem(RELEASE_RESET_KEY) === "1";
  } catch {
    // Storage can be unavailable in Safari private browsing or through blockers.
  }

  if (resetComplete) {
    if (returnedFromReset) {
      url.searchParams.delete(RELEASE_RESET_PARAM);
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    renderApp();
    return;
  }

  try {
    window.localStorage.setItem(RELEASE_RESET_KEY, "1");
  } catch {
    // The query parameter below prevents a reload loop when storage is blocked.
  }

  await Promise.allSettled([
    supabase.auth.signOut({ scope: "local" }),
    "caches" in window
      ? window.caches.keys().then((keys) => Promise.all(keys.map((key) => window.caches.delete(key))))
      : Promise.resolve(),
    "serviceWorker" in navigator
      ? navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister()))
        )
      : Promise.resolve(),
  ]);

  url.searchParams.set(RELEASE_RESET_PARAM, RELEASE_RESET_ID);
  window.location.replace(url.toString());
};

void runOneTimeReleaseReset();
