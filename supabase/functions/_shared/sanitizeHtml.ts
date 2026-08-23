// Minimal server-side HTML scrubber for untrusted inbound content.
// Not a full HTML parser — defence-in-depth alongside client-side DOMPurify.

const BLOCK_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'noscript', 'template'];
const VOID_TAGS = ['link', 'meta', 'base'];

export function sanitizeInboundHtml(input: string | null | undefined): string | null {
  if (!input) return input ?? null;
  let html = String(input);

  // Remove block elements (including content)
  for (const tag of BLOCK_TAGS) {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
    // Unclosed variants
    html = html.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '');
  }

  // Remove void/metadata elements
  for (const tag of VOID_TAGS) {
    html = html.replace(new RegExp(`<${tag}\\b[^>]*>`, 'gi'), '');
  }

  // Strip inline event handlers: onclick=... / onerror='...' / onload=foo
  html = html.replace(/\son[a-z-]+\s*=\s*"[^"]*"/gi, '');
  html = html.replace(/\son[a-z-]+\s*=\s*'[^']*'/gi, '');
  html = html.replace(/\son[a-z-]+\s*=\s*[^\s>]+/gi, '');

  // Strip dangerous attributes
  html = html.replace(/\s(srcdoc|formaction|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Neutralise javascript: and data:text/html URLs
  html = html.replace(
    /\s(href|src|action|background|poster)\s*=\s*("|')?\s*(javascript:|vbscript:|data:text\/html)[^"'>\s]*("|')?/gi,
    ' ',
  );

  return html;
}
