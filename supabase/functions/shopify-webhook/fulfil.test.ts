import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { retailTrackingUrl } from "./fulfil.ts";

Deno.test("tracking link points at the retail track page", () => {
  assertEquals(retailTrackingUrl("CCC754365464370LUCS11"), "https://cyclecourierco.com/pages/track?ref=CCC754365464370LUCS11");
});
