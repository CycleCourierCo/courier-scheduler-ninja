

## Fix SendZen Edge Function API Format

### Problem
The current edge function sends a flat structure (`template_name`, `parameters`, `lang_code` at top level). The SendZen API requires `type: "template"` with a nested `template` object containing `name`, `language.code`, and `components` array.

### Approach
We cannot use the Node.js SDK directly since edge functions run on Deno. However, the SDK README reveals the exact payload structure the API expects. I'll restructure the fetch payload to match.

### Changes: `supabase/functions/send-sendzen-whatsapp/index.ts`

Restructure all 4 template types from:
```json
{ "to": "...", "from": "...", "template_name": "review", "lang_code": "en_GB", "parameters": [...] }
```
To the correct format:
```json
{
  "to": "...",
  "from": "...",
  "type": "template",
  "template": {
    "name": "review",
    "language": { "code": "en_GB" },
    "components": [
      { "type": "body", "parameters": [{ "type": "text", "text": "John" }] }
    ]
  }
}
```

Specific mappings per template:

- **`collection_timeslots` / `delivery_timeslot`**: Body component with 6 text params (contact_name, bike_brand, bike_model, date, start_time, end_time) + URL button component (index 0, tracking URL)
- **`grouped_timeslot`**: Body component with 6 text params (contact_name, date, start_time, end_time, collection_job_list, delivery_job_list), no button
- **`review`**: Body component with 1 text param (customer_name), no button

Note: The SDK uses `language: { code: "en_GB" }` not `lang_code`. Parameters use `{ type: "text", text: "value" }` without `parameter_name`. Button components use `{ type: "button", sub_type: "url", index: 0, parameters: [{ type: "text", text: "url" }] }`.

