
# Remove Tracking Number from Email Subject

## Overview

Remove the tracking number prefix from the availability confirmation email subject line while keeping it in the email body.

## Current State

**Subject line** (line 92-94):
```typescript
emailOptions.subject = trackingNumber 
  ? `${trackingNumber} - Please confirm your ${availabilityType} availability`
  : `Please confirm your ${availabilityType} availability`;
```

Results in: `CCC754398327386ABDHP1 - Please confirm your pickup availability`

## Change Required

**File**: `supabase/functions/send-email/index.ts`

Simplify the subject line to always use the plain format:

```typescript
emailOptions.subject = `Please confirm your ${availabilityType} availability`;
```

Results in: `Please confirm your pickup availability`

## What Stays the Same

- Tracking number in the email body (inside the grey info box)
- Track Order button with link to tracking page
- All other email content

## Summary

| Item | Before | After |
|------|--------|-------|
| Subject | `CCC-XXX - Please confirm your pickup availability` | `Please confirm your pickup availability` |
| Body tracking info | Unchanged | Unchanged |
