# Fix Zod validation errors leaking to Sentry

## What's actually happening

These aren't real bugs in your data — they are ordinary "please fill this field in" form validation results being thrown as crashes.

The project uses Zod version 4, but the form-validation adapter (`@hookform/resolvers` 3.9.0) was built for Zod version 3. The adapter recognises a validation failure by looking for a property called `errors` on the error object. Zod 4 renamed that property to `issues`. So the adapter doesn't recognise the validation failure, rethrows it, nobody catches it, and the browser reports it as an unhandled crash — which your global handler forwards straight to Sentry.

Verified in the sandbox: Zod 4.1.11 produces an error where `errors` is not an array (`issues` is), which is exactly the condition the adapter fails on.

Side effect worth noting: on every form using this adapter, inline field error messages very likely never render at all, because the resolver never returns errors to the form — it throws instead. So users get a form that silently refuses to progress.

Affected forms (all six use the same adapter):
- Create Order
- Login, Register, Reset Password
- User Profile
- Tracking page

## The fix

1. Upgrade `@hookform/resolvers` to version 5.x, which supports Zod 4 natively. No changes needed to the schemas themselves.
2. Verify each of the six forms still validates correctly and now shows inline messages: submit each empty, confirm red field messages appear and no unhandled error is logged in the console.
3. Add a safety net in Sentry setup so validation errors can never be reported as crashes again: filter `ZodError` out in the global unhandled-rejection handler in `src/main.tsx` (and via `ignoreErrors`), since a validation failure is expected user behaviour, not an application fault.
4. Resolve the existing Sentry issues (JAVASCRIPT-REACT-FA and JAVASCRIPT-REACT-DF) once a build with the fix is live.

## Technical detail

- `node_modules/@hookform/resolvers/zod/dist/zod.js` guards with `Array.isArray(e?.errors)`; falling through, it does `throw e`. Resolvers v5 uses the Standard Schema interface and reads `issues`.
- The upgrade is a major version bump: import path stays `@hookform/resolvers/zod`, and `zodResolver(schema)` keeps the same call signature, so the six call sites need no edits. If TypeScript flags the generic inference on `useForm<CreateOrderFormData>`, adjust the type parameters at those call sites only.
- `src/main.tsx` change: in the `unhandledrejection` listener, skip capture when `event.reason?.name === 'ZodError'`, and add `ignoreErrors: [/ZodError/]` to `Sentry.init`.
- No database, edge function, or schema changes.
