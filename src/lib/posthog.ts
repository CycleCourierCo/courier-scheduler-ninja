import posthog from "posthog-js";

// PostHog is optional: if the connector isn't linked or an ad-blocker breaks
// the SDK, the app must still work. Every exported helper is a safe no-op
// when PostHog isn't running.
let initialised = false;

export const initPostHog = () => {
  const token = import.meta.env.VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY;
  if (!token || initialised) return;

  const region = import.meta.env.VITE_LOVABLE_CONNECTOR_POSTHOG_REGION || "eu";
  const apiHost =
    region === "us" ? "https://us.i.posthog.com" : "https://eu.i.posthog.com";

  try {
    posthog.init(token, {
      api_host: apiHost,
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      // The booking flow collects names, addresses and phone numbers — never
      // send input values or element attributes to PostHog.
      mask_all_element_attributes: true,
      mask_all_text: false,
      // Session replay off by default; enable deliberately in PostHog if needed.
      disable_session_recording: true,
      persistence: "localStorage+cookie",
    });
    initialised = true;
  } catch {
    // Analytics blocked or unavailable — carry on without it.
  }
};

export const identifyPostHogUser = (id: string, email?: string | null) => {
  if (!initialised) return;
  try {
    posthog.identify(id, email ? { email } : undefined);
  } catch {
    /* ignore */
  }
};

export const resetPostHogUser = () => {
  if (!initialised) return;
  try {
    posthog.reset();
  } catch {
    /* ignore */
  }
};
