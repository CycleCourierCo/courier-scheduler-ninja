

## Specific Error Messages on "Next" Button Click

Currently `handleNextToReceiver` shows a generic "Please fill in all required fields in Collection Information" toast. Instead, it should check **what specifically is wrong** and show targeted messages — especially for phone number issues.

### Changes

**`src/pages/CreateOrder.tsx`** — Replace `handleNextToReceiver` with specific error checking:

```tsx
const handleNextToReceiver = () => {
  if (isSenderValid) {
    setActiveTab("receiver");
    return;
  }
  
  const senderPhone = form.getValues("sender.phone");
  const senderEmail = form.getValues("sender.email");
  const senderName = form.getValues("sender.name");
  
  // Check specific issues and show targeted messages
  if (!senderName || senderName.trim().length < 2) {
    toast.error("Please enter the sender's full name.");
  } else if (!senderEmail || !EMAIL_REGEX.test(senderEmail)) {
    toast.error("Please enter a valid email address for the sender.");
  } else if (!senderPhone || senderPhone.trim() === '') {
    toast.error("Please enter the sender's phone number.");
  } else if (senderPhone.startsWith('+44') && senderPhone.substring(3).startsWith('0')) {
    toast.error("Remove the leading 0 after +44 (e.g. +447123456789, not +440712...)");
  } else if (senderPhone.startsWith('+44') && senderPhone.substring(3).replace(/\D/g, '').length > 10) {
    toast.error("Phone number is too long — must be +44 followed by exactly 10 digits.");
  } else if (senderPhone.startsWith('+44') && senderPhone.substring(3).replace(/\D/g, '').length < 10) {
    toast.error("Phone number is too short — must be +44 followed by exactly 10 digits.");
  } else if (!senderPhone.startsWith('+44')) {
    toast.error("Phone number must start with +44.");
  } else {
    // Check address fields
    const address = form.getValues("sender.address");
    if (!address?.street || !address?.city || !address?.zipCode) {
      toast.error("Please complete the sender's address (street, city, and postcode are required).");
    } else {
      toast.error("Please fill in all required fields in Collection Information.");
    }
  }
};
```

Apply the same pattern to `handleNextToSender` for bike details specifics, and ensure consistency.

### Files Modified
- `src/pages/CreateOrder.tsx` — replace generic toast in `handleNextToReceiver` (and optionally `handleNextToSender`) with specific field-level error messages

