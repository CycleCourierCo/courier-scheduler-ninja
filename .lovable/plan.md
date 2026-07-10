## Goal
Standardize on **Sonner** as the single toast/notification system across the app, with a shared helper for consistent types, durations, icons, and behavior. Migrate the last legacy `useToast` (shadcn) callers and replace ad‑hoc `confirm()` alerts where appropriate.

## Current state
- Sonner is already mounted in `src/App.tsx` (`<Toaster position="top-right" closeButton richColors />`) and used in ~70 files via `import { toast } from "sonner"`.
- Two files still use the legacy shadcn toast (`@/hooks/use-toast`): `src/pages/InvoicesPage.tsx`, `src/pages/DispatchRoutesPage.tsx`.
- A handful of `window.confirm()` calls are used for destructive actions (delete task, delete bay, delete invoice, reject claim, disconnect Shopify, etc.).
- No unified duration / icon / a11y policy — each caller picks its own options.

## What I'll build

### 1. Central notify helper — `src/lib/notify.ts`
Thin wrapper around `sonner`'s `toast` exposing one consistent API:

```ts
notify.success(msg, opts?)   // 4s auto-dismiss
notify.info(msg, opts?)      // 4s
notify.warning(msg, opts?)   // 6s
notify.error(msg, opts?)     // 10s + closeButton always shown
notify.loading(msg)          // sticky, returns id
notify.promise(promise, {...})
notify.dismiss(id?)
notify.confirm({ title, description, confirmLabel, onConfirm, destructive })
   // renders sonner action toast — replaces window.confirm()
```

Rules baked in:
- Sensible default durations per type (errors persist ~10s, others 4–6s).
- Icons via `lucide-react` (`CheckCircle2`, `Info`, `AlertTriangle`, `XCircle`) passed via `icon` option; sonner's `richColors` already colours them per type.
- All calls carry an `id` derived from message when the caller wants dedupe.
- Errors auto-attach `description` if an `Error`/`{message}` is passed.

### 2. Configure the global `<Toaster />` (src/App.tsx)
Update to a single source of truth:

```tsx
<Toaster
  position="top-right"
  closeButton
  richColors
  expand={false}
  visibleToasts={5}
  pauseWhenPageIsHidden
  toastOptions={{ duration: 4000, classNames: { toast: 'group' } }}
/>
```

Sonner already:
- Renders inside an `aria-live` region (polite; assertive for errors) — a11y ✓
- Pauses on hover ✓
- Stacks & animates cleanly ✓
- Supports manual dismiss via `closeButton` ✓

No custom rewrite needed — just enable the flags.

### 3. Migrate legacy shadcn toast callers
Replace in these two files with `notify.*`:
- `src/pages/InvoicesPage.tsx` (import + `const { toast } = useToast()` + call sites)
- `src/pages/DispatchRoutesPage.tsx` (import + call sites)

Then delete the legacy shim:
- `src/hooks/use-toast.ts`
- `src/components/ui/use-toast.ts`
- `src/components/ui/toaster.tsx`
(No remaining imports after the two migrations.)

### 4. Replace ad-hoc `window.confirm()` with `notify.confirm`
Migrate these to the new confirm toast (keeps UX consistent, non-blocking, dismissable):
- `src/pages/WarehouseStockPage.tsx` — remove stock item
- `src/components/tasks/TaskDetailDrawer.tsx` — delete task
- `src/pages/StorageBaysPage.tsx` — delete bay
- `src/pages/ShopifyIntegrationPage.tsx` — disconnect Shopify
- `src/pages/InvoicesPage.tsx` — delete invoice
- `src/pages/ClaimDetail.tsx` — reject claim
- `src/pages/FuelFinderPage.tsx` — delete fuel card
- `src/pages/BicycleInspections.tsx` — inspection status override
- `src/components/scheduling/RouteBuilder.tsx` — bulk push >20 jobs

Existing ~70 files that already call `toast.success/error/etc.` from sonner keep working unchanged — no churn. New code should prefer `notify.*` (documented briefly at top of `notify.ts`).

### 5. Where it's used — quick reference for you
After the change, I'll show:
- The `notify.ts` API and the updated `<Toaster />` config.
- List of migrated files (the 2 legacy + 9 confirm sites).
- Grep count of remaining `toast.*` sonner call sites (unchanged, ~70 files) so you can see coverage.

## Out of scope
- Rewriting every existing `toast.*` call to `notify.*` (unnecessary churn — both write to the same Sonner queue).
- Building a custom in-app notification center / history (transient toasts only, per request).
- Changing toast positioning per-page.

## Files touched
- **New:** `src/lib/notify.ts`
- **Edit:** `src/App.tsx` (Toaster props), `src/pages/InvoicesPage.tsx`, `src/pages/DispatchRoutesPage.tsx`, plus the 9 confirm-migration files listed above.
- **Delete:** `src/hooks/use-toast.ts`, `src/components/ui/use-toast.ts`, `src/components/ui/toaster.tsx`.
