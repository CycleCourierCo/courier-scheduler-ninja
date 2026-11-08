// Business sign-up rules shared by create-business-user and Vitest.
// No imports so the browser tests run the same code. The sign-up form
// mirrors the password rule in src/lib/registrationRules.ts.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const REGISTRATION_ATTEMPTS_PER_HOUR = 15;

export function passwordProblem(password: unknown): string | null {
  if (!password || typeof password !== "string") return "Enter a password.";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Your password needs at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Your password must be under ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Your password needs at least one letter and one number.";
  }
  return null;
}

/** Real visitor IP behind Cloudflare / proxies, so one office isn't treated as one person by mistake. */
export function registrationClientIp(headers: { get(name: string): string | null }): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Turn an auth error from account creation into a status + message the applicant can act on. */
export function registrationAuthError(message: string | undefined | null): { status: number; error: string } {
  const m = (message || "").toLowerCase();
  if (m.includes("already") && (m.includes("registered") || m.includes("exists"))) {
    return {
      status: 409,
      error: "An account with this email already exists. Sign in instead, or use “Forgot password” to reset it.",
    };
  }
  if (m.includes("password")) {
    return { status: 422, error: "That password isn't strong enough. Use at least 8 characters with letters and numbers." };
  }
  if (m.includes("email") && (m.includes("invalid") || m.includes("valid"))) {
    return { status: 422, error: "That email address doesn't look right. Check it and try again." };
  }
  return {
    status: 500,
    error: "We couldn't create your account just now. Please try again in a few minutes, or email info@cyclecourierco.com.",
  };
}
