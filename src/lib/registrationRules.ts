// Sign-up password rule. Keep in sync with supabase/functions/_shared/registrationRules.ts
// (registrationRules.test.ts checks both agree).
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_HINT = "At least 8 characters, with letters and numbers.";

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

/** Read the real message an Edge Function sent back, instead of "non-2xx status code". */
export async function edgeFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: unknown } | null)?.context as
    | { status?: number; clone?: () => Response; json?: () => Promise<unknown> }
    | undefined;
  let status: number | undefined;
  if (ctx && typeof ctx === "object") {
    status = typeof ctx.status === "number" ? ctx.status : undefined;
    try {
      const res = typeof ctx.clone === "function" ? ctx.clone() : (ctx as Response);
      const body = (await res.json()) as { error?: unknown } | null;
      if (body && typeof body.error === "string" && body.error.trim()) return body.error;
    } catch {
      /* body not JSON — fall through */
    }
  }
  if (status === 429) {
    return "Too many sign-up attempts from your connection. Please wait an hour and try again, or email info@cyclecourierco.com.";
  }
  return fallback;
}
