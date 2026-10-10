# Fix fuel invoice upload error on iPhone ("undefined is not a function")

## Root cause

The PDF reader library we use for fuel invoices (pdfjs-dist v6) needs a fairly new browser feature called `Promise.withResolvers`. It only exists in Safari 17.4 or later. On an older iPhone/iPad, the moment the app opens the invoice PDF, the library crashes with Safari's "undefined is not a function" error — before any reading or saving happens. The invoice file itself is fine (verified: it opens and reads correctly, 4 pages of transactions).

## Fix

- Add a small compatibility shim in `src/lib/pdfText.ts`, before the PDF library loads:
  - Provide `Promise.withResolvers` when the browser doesn't have it.
  - Provide a fallback for reading the file's bytes when `file.arrayBuffer()` is missing (also absent on older Safari).
- No changes to the parser, the upload flow, or any data — the same invoices will import exactly as they do on newer browsers.

## Verification

- Typecheck/build passes.
- Re-run the extraction test against the uploaded WEX invoice to confirm parsing still works.

## Note

If your iPhone is on an older iOS, other modern features may also be missing over time; updating iOS is still worthwhile, but this fix makes invoice upload work regardless.
