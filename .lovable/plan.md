

# Fix: Use Verified Email Domain for Route Reports

## Problem Identified

The `send-route-report` function uses an unverified email domain:
```typescript
from: "Cycle Courier Co. <noreply@cyclecourierco.com>"  // ❌ Not verified
```

But the working timeslot emails use:
```typescript
from: "Ccc@notification.cyclecourierco.com"  // ✅ Verified
```

The domain `notification.cyclecourierco.com` is verified in Resend, but `cyclecourierco.com` is not.

---

## Solution

Update the `send-route-report` edge function to use the same verified "from" email address.

---

## File to Modify

`supabase/functions/send-route-report/index.ts`

### Change

**Line 252-253 - Current:**
```typescript
from: "Cycle Courier Co. <noreply@cyclecourierco.com>",
```

**Updated:**
```typescript
from: "Cycle Courier Co. <Ccc@notification.cyclecourierco.com>",
```

---

## Also: Match Resend Import Style

The timeslot function uses:
```typescript
import { Resend } from "https://esm.sh/resend@2.0.0";
```

But the route report uses:
```typescript
import { Resend } from "npm:resend@2.0.0";
```

Both should work, but for consistency, I'll align the import style.

---

## Summary

| Item | Before | After |
|------|--------|-------|
| From email | `noreply@cyclecourierco.com` | `Ccc@notification.cyclecourierco.com` |
| Display name | Cycle Courier Co. | Cycle Courier Co. (unchanged) |
| Resend import | `npm:resend@2.0.0` | `https://esm.sh/resend@2.0.0` |

This single change will allow the route report emails to send successfully using the already-verified domain.

