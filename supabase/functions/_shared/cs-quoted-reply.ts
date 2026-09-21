// Trims quoted history from inbound customer emails so the inbox shows only
// what the customer actually wrote in this reply.

const TEXT_MARKERS: RegExp[] = [
  // "On Sun, 20 Sept 2026, 20:02 Someone <a@b.com> wrote:"
  /^\s*On\s.{0,200}\swrote:\s*$/im,
  /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/im,
  /^\s*-{2,}\s*Forwarded message\s*-{2,}\s*$/im,
  /^\s*_{5,}\s*$/m,
  /^\s*From:\s.+$/im,
  /^\s*Sent from my \w+/im,
];

/** Removes quoted history from the plain-text body. */
export function stripQuotedText(text?: string | null): string | null {
  if (!text) return text ?? null;

  let cut = text.length;
  for (const re of TEXT_MARKERS) {
    const m = re.exec(text);
    if (m && m.index < cut) cut = m.index;
  }

  let out = text.slice(0, cut);

  // Drop trailing ">" quote blocks that survived.
  out = out
    .split(/\r?\n/)
    .filter((line) => !/^\s*>/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Never lose the message entirely.
  return out.length ? out : text;
}

/** Repeats the tag strip until the string stops changing, so markup removed
 *  by one pass cannot expose another tag construct (bounded to 10 passes). */
function stripTagsUntilStable(input: string): string {
  let prev = input;
  let next = prev.replace(/<[^>]*>/g, "");
  let passes = 1;
  while (next !== prev && passes < 10) {
    prev = next;
    next = prev.replace(/<[^>]*>/g, "");
    passes++;
  }
  return next;
}

/** Removes quoted history blocks from the HTML body. */
export function stripQuotedHtml(html?: string | null): string | null {
  if (!html) return html ?? null;

  let out = html;

  // Gmail / Apple Mail / Outlook quote containers.
  const containerPatterns: RegExp[] = [
    /<div[^>]*class="[^"]*gmail_quote[^"]*"[\s\S]*$/i,
    /<blockquote[\s\S]*$/i,
    /<div[^>]*id="?(appendonsend|divRplyFwdMsg)"?[\s\S]*$/i,
    /<div[^>]*class="[^"]*OutlookMessageHeader[^"]*"[\s\S]*$/i,
    /<hr[^>]*id="?stopSpelling"?[\s\S]*$/i,
  ];
  for (const re of containerPatterns) {
    out = out.replace(re, "");
  }

  // "On ... wrote:" attribution lines that sit outside a blockquote.
  const attribution = /<div[^>]*>\s*On\s[\s\S]{0,300}?wrote:\s*<\/div>[\s\S]*$/i;
  out = out.replace(attribution, "");

  const textual = stripTagsUntilStable(out).replace(/&nbsp;/g, " ").trim();
  return textual.length ? out : html;
}
