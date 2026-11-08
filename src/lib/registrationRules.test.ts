import { describe, it, expect } from "vitest";
import { passwordProblem, edgeFunctionErrorMessage } from "./registrationRules";
import {
  passwordProblem as serverPasswordProblem,
  registrationAuthError,
  registrationClientIp,
  REGISTRATION_ATTEMPTS_PER_HOUR,
} from "../../supabase/functions/_shared/registrationRules";

const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });

describe("business sign-up rules", () => {
  it("form and server agree on every password", () => {
    for (const p of ["", "abc12", "abcdefg1", "abcdefgh", "12345678", "Bike2026", "a".repeat(127) + "1", "a".repeat(128) + "1"]) {
      expect(passwordProblem(p)).toBe(serverPasswordProblem(p));
    }
  });

  it("rejects a 7-character password and accepts 8 with a letter and number", () => {
    expect(passwordProblem("abcdef1")).not.toBeNull();
    expect(passwordProblem("abcdefg1")).toBeNull();
  });

  it("rejects a letters-only password", () => {
    expect(passwordProblem("abcdefghij")).not.toBeNull();
  });

  it("allows 15 sign-up attempts per hour per connection", () => {
    expect(REGISTRATION_ATTEMPTS_PER_HOUR).toBe(15);
  });

  it("uses the Cloudflare visitor IP before the proxy chain", () => {
    expect(registrationClientIp(headers({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("1.1.1.1");
    expect(registrationClientIp(headers({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
  });

  it("tells an existing customer to sign in instead", () => {
    const r = registrationAuthError("A user with this email address has already been registered");
    expect(r.status).toBe(409);
    expect(r.error).toMatch(/already exists/);
  });

  it("shows the server's message instead of the generic non-2xx text", async () => {
    const err = { message: "Edge Function returned a non-2xx status code", context: new Response(JSON.stringify({ error: "Your password needs at least 8 characters." }), { status: 400 }) };
    expect(await edgeFunctionErrorMessage(err, "fallback")).toBe("Your password needs at least 8 characters.");
  });

  it("explains a rate-limit block even without a message body", async () => {
    const err = { context: new Response("", { status: 429 }) };
    expect(await edgeFunctionErrorMessage(err, "fallback")).toMatch(/wait an hour/);
  });
});
