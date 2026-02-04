
# Add Email Loading Lists Alongside WhatsApp

## Overview

Add email capability to the existing loading list functionality so that:
1. Individual drivers receive their personalized loading lists via email (in addition to WhatsApp)
2. Admin receives the management overview email at `Info@cyclecourierco.com`

---

## Current System

| Channel | Recipient | Content |
|---------|-----------|---------|
| WhatsApp | Management (+441217980767) | Full overview with FROM/TO depot sections |
| WhatsApp | Individual Drivers | Personalized loading list with 4 sections |

## New System (After Changes)

| Channel | Recipient | Content |
|---------|-----------|---------|
| WhatsApp | Management (+441217980767) | Full overview with FROM/TO depot sections |
| WhatsApp | Individual Drivers | Personalized loading list with 4 sections |
| Email | Info@cyclecourierco.com | Full management overview (HTML formatted) |
| Email | Individual Drivers | Personalized loading list (HTML formatted) |

---

## Implementation Approach

### Option 1: Extend Existing WhatsApp Function (Recommended)
Add email sending to the same `send-loading-list-whatsapp` edge function, reusing the existing message formatting logic.

### Option 2: Create Separate Email Function
Create a new `send-loading-list-email` edge function and call both from the frontend.

**Recommendation**: Option 1 - keeps all loading list logic in one place and ensures consistency.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/send-loading-list-whatsapp/index.ts` | Add email sending logic using Resend API |
| `src/pages/LoadingUnloadingPage.tsx` | Add driver email input fields and pass to function |
| Database (optional) | Store driver emails in profiles for future use |

---

## Technical Implementation

### 1. Update Edge Function (`send-loading-list-whatsapp/index.ts`)

Add Resend import and email sending logic:

```typescript
import { Resend } from "npm:resend@4.0.0";

// Add to request interface
interface LoadingListRequest {
  date: string;
  bikesNeedingLoading: { ... }[];
  driverPhoneNumbers?: Record<string, string>;
  driverEmails?: Record<string, string>;  // NEW
}
```

Create HTML email templates:
- Management email with styled tables for FROM/TO depot sections
- Driver emails with styled sections for their tasks

Send emails after WhatsApp:
```typescript
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const resend = new Resend(RESEND_API_KEY);

// Send admin email
await resend.emails.send({
  from: "Ccc@notification.cyclecourierco.com",
  to: "Info@cyclecourierco.com",
  subject: `Loading List - ${date}`,
  html: managementEmailHtml
});

// Send driver emails
for (const [driverName, driverEmail] of Object.entries(driverEmails)) {
  const driverHtml = buildDriverEmailHtml(driverName, categories, date);
  await resend.emails.send({
    from: "Ccc@notification.cyclecourierco.com", 
    to: driverEmail,
    subject: `Your Loading List - ${date}`,
    html: driverHtml
  });
}
```

### 2. Update LoadingUnloadingPage.tsx

Add email fields to the driver phone dialog:
- Add `driverEmails` state alongside `driverPhoneNumbers`
- Add email input field for each driver in the dialog
- Pass `driverEmails` to the edge function call

### 3. Email Templates

Create HTML-formatted versions of the existing WhatsApp messages:

**Management Email:**
```text
┌────────────────────────────────────────────┐
│       LOADING LIST - 2026-02-04            │
├────────────────────────────────────────────┤
│                                            │
│  📤 FROM DEPOT → DRIVERS (Outbound)        │
│  ┌────────────────────────────────────┐    │
│  │ Driver Name (3 bikes)              │    │
│  │ • Bay A1: Trek Domane - Customer X │    │
│  │ • Bay B5: Specialized - Customer Y │    │
│  └────────────────────────────────────┘    │
│                                            │
│  📥 TO DEPOT ← DRIVERS (Inbound)           │
│  ┌────────────────────────────────────┐    │
│  │ Driver Name bringing in (2 bikes)  │    │
│  │ • Trek Emonda - No delivery driver │    │
│  └────────────────────────────────────┘    │
│                                            │
│  📊 SUMMARY                                │
│  • Outbound: 5 bikes                       │
│  • Inbound: 2 bikes                        │
│  • Total drivers: 3                        │
└────────────────────────────────────────────┘
```

**Driver Email:**
- Same 4 sections as WhatsApp but formatted as HTML tables
- Mobile-responsive design

---

## Response Structure Update

```typescript
return new Response(JSON.stringify({ 
  success: true,
  whatsapp: {
    management: { sent: true },
    drivers: { count: 3, sent: 3 }
  },
  email: {
    management: { sent: true, to: "Info@cyclecourierco.com" },
    drivers: { count: 2, sent: 2 }  // Only drivers with emails
  },
  totalBikes: 10
}));
```

---

## UI Changes

### Driver Phone/Email Dialog

```text
┌─────────────────────────────────────────────────────────┐
│  Send Loading List                                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Enter contact details for each driver:                  │
│                                                          │
│  Driver: John Smith                                      │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Phone: +44 7xxx xxx xxx                             ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │ Email: john@example.com                             ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  Driver: Jane Doe                                        │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Phone: +44 7xxx xxx xxx                             ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │ Email: jane@example.com                             ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│            [Cancel]    [Send Loading List]               │
└─────────────────────────────────────────────────────────┘
```

---

## Summary

| Task | Description |
|------|-------------|
| Extend edge function | Add Resend email sending to existing WhatsApp function |
| Create HTML templates | Convert WhatsApp text format to styled HTML emails |
| Add email fields | Add driver email inputs to the dialog |
| Send admin email | Always send to Info@cyclecourierco.com |
| Send driver emails | Send to drivers who have email addresses provided |
| Update response | Return status for both WhatsApp and email sends |
