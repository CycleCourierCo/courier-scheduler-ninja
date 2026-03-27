

## Fix: list-sendzen-templates response parsing

### Problem
The error `(data.data || data || []).filter is not a function` means `data.data` exists but is not an array — it's likely an object (e.g., the SendZen API may return a paginated response where templates are nested differently, such as under `message_templates` or another key).

### Fix

**`supabase/functions/list-sendzen-templates/index.ts`** — single file change:

1. Add `console.log(JSON.stringify(data))` right after `const data = await response.json()` to capture the actual response shape in logs
2. Replace the brittle `(data.data || data || []).filter(...)` with robust extraction that checks multiple paths:
   - `data.data` if it's an array
   - `data.message_templates` 
   - `data` itself if it's an array
   - Fallback to empty array with a warning log
3. Add `Array.isArray()` guard before calling `.filter()`

```typescript
// After: const data = await response.json();
console.log("SendZen raw response keys:", Object.keys(data));

let rawTemplates: any[] = [];
if (Array.isArray(data)) {
  rawTemplates = data;
} else if (Array.isArray(data?.data)) {
  rawTemplates = data.data;
} else if (Array.isArray(data?.message_templates)) {
  rawTemplates = data.message_templates;
} else {
  console.warn("Unknown SendZen response shape:", JSON.stringify(data).slice(0, 500));
}

const templates = rawTemplates
  .filter((t: any) => t.status === "APPROVED")
  .map((t: any) => ({ ... }));
```

The API spec confirms the endpoint URL (`/v1/{WABA_ID}/message_templates`), auth method (`Bearer` token), and HTTP method (`GET`) are all correct in the current code. Only the response parsing needs fixing.

