/**
 * Logging utility that logs in development and sends errors to Sentry in production
 */
import * as Sentry from "@sentry/react";

const isDevelopment = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args);
    } else {
      // Send to Sentry in production
      const error = args[0] instanceof Error 
        ? args[0] 
        : new Error(String(args[0]));
      Sentry.captureException(error, {
        extra: { additionalArgs: args.slice(1) }
      });
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  }
};
