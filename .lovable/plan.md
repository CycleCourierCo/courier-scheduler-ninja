

## Add SendZen Template Selector to WhatsApp Announcements

### What it does
Adds a dropdown to the WhatsApp compose section that fetches available templates from SendZen, letting the admin choose between sending a plain text message or a pre-approved WhatsApp template. When a template is selected, dynamic input fields appear for each template parameter.

### Changes

**1. New Edge Function: `supabase/functions/list-sendzen-templates/index.ts`**
- `GET` handler that calls SendZen API: `GET /v1/{WABA_ID}/message_templates`
- Uses `SENDZEN_API_KEY` (existing) and a new `SENDZEN_WABA_ID` secret for the WhatsApp Business Account ID
- Returns the list of approved templates with their name, language, components/parameters
- Filters to only `APPROVED` status templates

**2. New secret: `SENDZEN_WABA_ID`**
- The WhatsApp Business Account ID needed for the List Templates endpoint
- Will request via the secrets tool during implementation

**3. Update Edge Function: `supabase/functions/send-announcement-whatsapp/index.ts`**
- Add support for a `template` mode alongside existing `text` mode
- When `templateName`, `langCode`, and `parameters` are provided, send as a template message instead of plain text
- Uses the same SendZen template payload structure as the existing `send-sendzen-whatsapp` function

**4. Update `src/pages/AnnouncementEmailsPage.tsx`**
- Add a mode toggle at the top of the WhatsApp compose card: "Plain Text" | "Template"
- In template mode:
  - Fetch templates via `list-sendzen-templates` edge function (react-query)
  - Show a Select dropdown with template names
  - When a template is selected, parse its components and show input fields for each body parameter (pre-labelled with `parameter_name`)
  - Hide the plain text textarea
- Update the Send WhatsApp handler to pass either `{ phone, message }` (plain text) or `{ phone, templateName, langCode, parameters }` (template mode) to the edge function
- The template parameter inputs will be plain text inputs, one per parameter

### Flow
```text
Admin opens Announcements → WhatsApp card
  → Tabs: "Plain Text" | "Template"
  → If Template:
      → Dropdown loads templates from SendZen API
      → Admin selects a template
      → Input fields appear for each parameter
      → Admin fills in values
      → Clicks "Send WhatsApp"
      → Edge function sends template message to each recipient
```

### Technical Details
- SendZen List Templates API: `GET https://api.sendzen.io/v1/{WABA_ID}/message_templates`
- Template response includes `components` array with parameter definitions
- Template send payload matches existing pattern in `send-sendzen-whatsapp`: `type: "template"` with `template.name`, `template.lang_code`, and `template.components`
- Parameters like `contact_name` can be auto-filled from the recipient profile where applicable

