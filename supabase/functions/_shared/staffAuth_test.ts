import { assertEquals } from "jsr:@std/assert@1";
import { isStaffRole } from "./staffAuth.ts";
Deno.test("only listed staff roles count as staff", () => {
  assertEquals(isStaffRole("loader"), true);
  assertEquals(isStaffRole("b2c_customer"), false);
  assertEquals(isStaffRole("future_role"), false);
});
