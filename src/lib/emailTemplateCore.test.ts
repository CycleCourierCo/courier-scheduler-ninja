import { describe, it, expect } from "vitest";
import { fillVars, isSendAllowed, cleanAddresses, safeUrl } from "../../supabase/functions/_shared/emailTemplateCore";

describe("Email Centre rules", () => {
  it("escapes customer details in email wording", () => {
    expect(fillVars("Hi {{customer_name}}", { customer_name: "<b>Al</b>" }, true)).toBe("Hi &lt;b&gt;Al&lt;/b&gt;");
  });
  it("drops unknown tags instead of evaluating them", () => {
    expect(fillVars("x{{password}}y", {}, false)).toBe("xy");
  });
  it("locked emails are always sent even if switched off", () => {
    expect(isSendAllowed({ enabled: false, locked: true })).toBe(true);
  });
  it("unlocked emails that are switched off are not sent", () => {
    expect(isSendAllowed({ enabled: false, locked: false })).toBe(false);
  });
  it("with no saved settings the original email still sends", () => {
    expect(isSendAllowed(null)).toBe(true);
  });
  it("only keeps valid copy addresses", () => {
    expect(cleanAddresses(["ops@ccc.com", "nope", "a b@c.com"])).toEqual(["ops@ccc.com"]);
  });
  it("rejects non-https button links", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
  });
});
