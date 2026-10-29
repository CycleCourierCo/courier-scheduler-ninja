import { assertEquals } from "jsr:@std/assert@1";
import { verify } from "./verify.ts";

const enc = new TextEncoder();
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
async function signed(body: string, comps = '("@method" "@authority" "@path" "content-digest" "content-type" "webhook-id")', expiresIn = 300) {
  const now = Math.floor(Date.now() / 1000);
  const digest = b64(await crypto.subtle.digest("SHA-256", enc.encode(body)));
  const params = `;created=${now};expires=${now + expiresIn};keyid="v1";alg="hmac-sha256"`;
  const headers = new Headers({ host: "example.test", "content-type": "application/json", "content-digest": `sha-256=:${digest}:`, "webhook-id": "evt-1" });
  const names = [...comps.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const lines = names.map((c) => `"${c}": ${c === "@method" ? "POST" : c === "@authority" ? "example.test" : c === "@path" ? "/hook" : headers.get(c)}`);
  lines.push(`"@signature-params": ${comps}${params}`);
  const key = await crypto.subtle.importKey("raw", enc.encode("test-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  headers.set("signature-input", `sig=${comps}${params}`);
  headers.set("signature", `sig=:${b64(await crypto.subtle.sign("HMAC", key, enc.encode(lines.join("\n"))))}:`);
  return headers;
}
const req = (h: Headers, body: string) => new Request("https://example.test/hook", { method: "POST", headers: h, body });

Deno.test("accepts a signed body and delivery id", async () => {
  const body = '{"type":"sms.delivered"}';
  assertEquals(await verify(req(await signed(body), body), body, "test-secret"), true);
});
Deno.test("rejects a changed body", async () => {
  const h = await signed('{"a":1}');
  assertEquals(await verify(req(h, '{"a":2}'), '{"a":2}', "test-secret"), false);
});
Deno.test("rejects method-only signatures", async () => {
  const body = "{}";
  assertEquals(await verify(req(await signed(body, '("@method")'), body), body, "test-secret"), false);
});
Deno.test("rejects expired signatures", async () => {
  const body = "{}";
  assertEquals(await verify(req(await signed(body, undefined, -1), body), body, "test-secret"), false);
});
