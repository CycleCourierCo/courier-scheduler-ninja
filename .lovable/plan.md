# Fix fuel invoice upload on older iPhone Safari (second missing feature)

## What's happening
The first fix worked — the PDF now opens on your iPhone. It now fails one step later, while reading the text off each page. The PDF reader loops over the page text in a way that older Safari (before 18) can't do, so it stops with "undefined is not a function (near '...value of readableStream...')". The invoice itself is fine.

## Fix
1. Add the missing piece to the same compatibility file the first fix used, so older Safari can step through the page text the way the PDF reader expects. Newer browsers that already have it are left alone.
2. Check every other place the PDF reader (and its background helper) relies on newer browser features, and cover any others now, so this doesn't fail again on a third step.
3. Run the WEX invoice you uploaded through the reader again, with the newer browser features switched off to mimic your iPhone, and confirm all 4 pages of transactions come out.

After that, upload the invoice again on the Fuel Finder page.

## Technical details
- Cause: `PDFPageProxy.getTextContent()` in pdfjs-dist 6.2.108 uses `for await (const value of readableStream)`, which needs `ReadableStream.prototype[Symbol.asyncIterator]`. Safari added that in 18.0.
- In `src/lib/pdfPolyfill.ts`, if `ReadableStream.prototype[Symbol.asyncIterator]` is missing, define `values({ preventCancel })` and `[Symbol.asyncIterator]` using `getReader()`/`read()`, with `return()` releasing the lock (and cancelling unless `preventCancel`).
- Scan `pdf.mjs` and `pdf.worker.min.mjs` for other recent APIs (`Array.prototype.at`, `Object.hasOwn`, `structuredClone`, `Uint8Array.fromBase64`/`toHex`, `Map.groupBy`, `Promise.try`, `Math.sumPrecise`). The worker runs in its own context and does not load our polyfill, so if it needs any, load the worker with a small wrapper that applies the shims before importing the real worker.
- Verify in Node with `ReadableStream.prototype[Symbol.asyncIterator]` and `Promise.withResolvers` deleted beforehand, against the uploaded WEX PDF.
