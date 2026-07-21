## 1. QuickBooks Batch — retry on 429 + better error messages

**Problem recap**
- Broximo / Ben George / Adam Harrison failed with `429 ThrottleExceeded` on the initial customer lookup because the batch fires 5 invoice creations in parallel.
- All failures currently store the generic `"Edge Function returned a non-2xx status code"` in `invoice_history.error_message`, hiding the real cause.

**Changes to `supabase/functions/create-quickbooks-invoice/index.ts`**
- Wrap every QuickBooks HTTP call (customer query, invoice create, any follow-up reads) in a `qbFetch()` helper that retries on `429` and `5xx` with exponential backoff + jitter (e.g. 500ms → 1s → 2s → 4s, max 5 attempts, respecting a `Retry-After` header if present).
- On final failure, return a structured JSON body `{ error, status, details }` with a human-readable `error` string (e.g. `"QuickBooks rate limit exceeded after 5 retries"`, `"Customer not found in QuickBooks for email: X"`).

**Changes to the invoice callers (`weekly-invoice-batch` edge function + `InvoicesPage.tsx`)**
- When `functions.invoke` returns a non-2xx, read the response body and persist the specific `error` string into `invoice_history.error_message` instead of the generic message.
- Reduce batch concurrency from 5 → 3 to lower the chance of tripping QB throttling in the first place (retries remain the safety net).

**Result**
- Transient 429s are recovered automatically.
- Persistent failures (like Mark Rushby's missing QB customer) show up in `invoice_history.error_message` with the exact reason, visible in the report email and the Invoices page.

## 2. "Create customer in QuickBooks" button error

**Root cause (confirmed in edge-function logs)**
```
QuickBooks create customer failed: 400
{"Fault":{"Error":[{"Message":"Duplicate Name Exists Error",
 "Detail":"The name supplied already exists. : null","code":"6240"}]}}
```
`create-quickbooks-customer` searches QuickBooks **by email only**. If a customer with the same **DisplayName** already exists in QB under a different email (or no email), the pre-check misses it and the create call is rejected with code `6240`.

**Fix in `supabase/functions/create-quickbooks-customer/index.ts`**
1. After the email lookup misses, run a second query by `DisplayName` (escaped) — `SELECT * FROM Customer WHERE DisplayName = '<name>'`. If a match exists, link that QB customer id to the profile and return `{ customerId, alreadyExisted: true }`.
2. If the create call still returns `6240`, fall back to the DisplayName query one more time and link it — this handles the race where the QB search index lagged.
3. Return a friendlier error body on other failures (`{ error: "QuickBooks: <Message>", details }`) so the toast on `InvoicesPage`/profile shows the real reason instead of `"Edge Function returned a non-2xx status code"`.

**Frontend**
- Update the toast in whichever component invokes `create-quickbooks-customer` to display the `error` field from the response body when present.

## Technical notes

- No database migrations needed.
- Files touched:
  - `supabase/functions/create-quickbooks-invoice/index.ts` (retry helper, structured errors)
  - `supabase/functions/create-quickbooks-customer/index.ts` (DisplayName fallback, structured errors)
  - `supabase/functions/weekly-invoice-batch/index.ts` (persist real error, lower concurrency)
  - `src/pages/InvoicesPage.tsx` (persist real error, lower concurrency, surface message)
  - Component with the "Create QB customer" button (surface `error` field in toast)
