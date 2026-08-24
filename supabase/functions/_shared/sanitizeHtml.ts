// Minimal server-side HTML scrubber for untrusted inbound content.
// Not a full HTML parser — defence-in-depth alongside client-side DOMPurify.

const BLOCK_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'noscript', 'template'];
const VOID_TAGS = ['link', 'meta', 'base'];

function replaceUntilStable(input: string, replacer: (s: string) => string): string {
  let prev = input;
  let next = replacer(prev);
  while (next !== prev) {
    prev = next;
    next = replacer(prev);
  }
  return next;
}

export function sanitizeInboundHtml(input: string | null | undefined): string | null {
  if (!input) return input ?? null;
  let html = String(input);

  // Remove block elements (including content)
  for (const tag of BLOCK_TAGS) {
    html = replaceUntilStable(html, (s) => {
      let out = s.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
      // Unclosed variants
      out = out.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '');
      return out;
    });
  }

  // Remove void/metadata elements
  for (const tag of VOID_TAGS) {
    html = replaceUntilStable(html, (s) => s.replace(new RegExp(`<${tag}\\b[^>]*>`, 'gi'), ''));
  }

  // Strip inline event handlers: onclick=... / onerror='...' / onload=foo
  // Anchored on attribute boundaries and matched against valid event names.
  html = replaceUntilStable(html, (s) => {
    let out = s.replace(/(^|[\s"'])(on[a-z0-9_-]+)\s*=\s*"[^"]*"/gi, '$1');
    out = out.replace(/(^|[\s"'])(on[a-z0-9_-]+)\s*=\s*'[^']*'/gi, '$1');
    out = out.replace(/(^|[\s"'])(on[a-z0-9_-]+)\s*=\s*[^\s>]+/gi, '$1');
    // Safety net: rename any surviving on* attribute inside a start tag so it cannot execute.
    out = out.replace(/(<[a-zA-Z][^\s>]*\s+)(on[a-z0-9_-]+)(\s*=)/gi, '$1data-removed-$2$3');
    return out;
  });

  // Strip dangerous attributes
  html = replaceUntilStable(html, (s) =>
    s.replace(/\s(srcdoc|formaction|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  );

  // Neutralise javascript: and data:text/html URLs
  html = replaceUntilStable(html, (s) =>
    s.replace(
      /\s(href|src|action|background|poster)\s*=\s*("|')?\s*(javascript:|vbscript:|data:text\/html)[^"'>\s]*("|')?/gi,
      ' ',
    )
  );

  return html;
}
