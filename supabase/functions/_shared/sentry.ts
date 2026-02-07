import * as Sentry from "https://deno.land/x/sentry@8.45.0/index.mjs";

const SENTRY_DSN = Deno.env.get("SENTRY_DSN");

/**
 * Initialize Sentry for Edge Functions
 * Should be called once at the start of request handling
 */
export function initSentry(functionName: string): void {
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

/**
 * Capture an exception with optional context
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!SENTRY_DSN) return;
  
  if (context) {
    Sentry.setContext("additional", context);
  }
  Sentry.captureException(error);
}

/**
 * Wrap an async handler with Sentry error tracking and a span
 */
export async function withSentry<T>(
  functionName: string,
  handler: () => Promise<T>
): Promise<T> {
  initSentry(functionName);
  
  if (!SENTRY_DSN) {
    return handler();
  }
  
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

/**
 * Create a child span for tracking sub-operations
 */
export function startSpan<T>(
  op: string,
  name: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  if (!SENTRY_DSN) {
    return fn();
  }
  
  return Sentry.startSpan({ op, name }, fn);
}

export { Sentry };
