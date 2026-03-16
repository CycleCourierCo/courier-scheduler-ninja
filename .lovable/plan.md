

## Fix Create Order Phone Validation UX

### Problem
1. When phone numbers don't match `+44XXXXXXXXXX`, the Next/Create buttons are silently greyed out with zero feedback -- users think the form is broken.
2. No format hint on the phone input telling users what's expected.
3. The Sentry ZodError is the resolver throwing when validation fails on submit -- this is expected behavior but surfaces as an unhandled rejection in some cases.

### Changes

**`src/pages/CreateOrder.tsx`**
- Change the disabled Next/Create buttons to **always be enabled** but show a toast with specific errors when clicked and validation fails:
  - `handleNextToSender`: Already works this way. No change needed.
  - `handleNextToReceiver`: Remove `disabled={!isSenderValid}` from the button; keep the existing toast logic that fires on click.
  - Create Order button: Remove `disabled={!isReceiverValid}`; the `form.handleSubmit` error callback already shows toasts per tab.
- Keep `disabled` on the **tab triggers** (so users can't skip tabs), but remove `disabled` from the **action buttons** so they always show feedback on click.
- Add a `handleCreateOrder` function that triggers receiver validation and shows specific field-level errors via toast before submitting.

**`src/components/ContactForm.tsx`**
- Add a `FormDescription` hint under the phone field: `"Format: +44 followed by 10 digits (e.g. +447123456789)"`
- This tells users upfront what's expected.

### Files Modified
- `src/pages/CreateOrder.tsx` -- remove `disabled` from action buttons, add click handlers with error toasts
- `src/components/ContactForm.tsx` -- add phone format hint

