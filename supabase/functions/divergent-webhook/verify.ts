// Divergent Connect RFC 9421 webhook verification. No imports, so tests use the deployed rule.
const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

function timingSafeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function verify(req: Request, raw: string, secret: string, nowMs = Date.now()): Promise<boolean> {
  const sigInput = req.headers.get("signature-input");
  const sigHeader = req.headers.get("signature");
  const digestHeader = req.headers.get("content-digest") || "";
  if (req.method !== "POST" || !sigInput || !sigHeader || !req.headers.get("webhook-id")) return false;
  const actual = b64(await crypto.subtle.digest("SHA-256", enc.encode(raw)));
  const dm = digestHeader.match(/(?:^|,)\s*sha-256=:([^:]+):\s*(?:,|$)/i);
  if (!dm || !timingSafeEq(dm[1], actual)) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const url = new URL(req.url);
  for (const part of sigInput.split(/,(?=\s*[\w-]+=\()/)) {
    const m = part.trim().match(/^([\w-]+)=(\(.*?\))(.*)$/);
    if (!m) continue;
    const [, label, list, params] = m;
    const exp = [...params.matchAll(/;expires=(\d+)/g)];
    const created = [...params.matchAll(/;created=(\d+)/g)];
    if (exp.length !== 1 || created.length > 1) continue;
    const expiresMs = Number(exp[0][1]) * 1000;
    const createdMs = created.length ? Number(created[0][1]) * 1000 : null;
    if (expiresMs <= nowMs || expiresMs > nowMs + 5 * 60_000 + 30_000) continue;
    if (createdMs !== null && (createdMs > nowMs + 30_000 || nowMs - createdMs > 5 * 60_000 + 30_000 || expiresMs <= createdMs || expiresMs - createdMs > 5 * 60_000)) continue;
    const comps = [...list.matchAll(/"([^"]+)"/g)].map((x) => x[1].toLowerCase());
    const covers = (c: string) => comps.includes(c);
    if (!covers("content-digest") || !covers("webhook-id") || !covers("@method") || !(covers("@target-uri") || (covers("@authority") && covers("@path")))) continue;
    const lines = comps.map((c) => {
      let v = "";
      if (c === "@method") v = req.method.toUpperCase();
      else if (c === "@authority") v = req.headers.get("host") || url.host;
      else if (c === "@path") v = url.pathname;
      else if (c === "@query") v = url.search || "?";
      else if (c === "@target-uri") v = req.url;
      else v = (req.headers.get(c) || "").trim();
      return `"${c}": ${v}`;
    });
    lines.push(`"@signature-params": ${list}${params}`);
    const expected = b64(await crypto.subtle.sign("HMAC", key, enc.encode(lines.join("\n"))));
    const sm = sigHeader.match(new RegExp(`(?:^|,)\\s*${label}=:([^:]+):`));
    if (sm && timingSafeEq(sm[1], expected)) return true;
  }
  return false;
}

