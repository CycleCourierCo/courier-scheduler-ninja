

## Fix Fuel Finder Edge Function — Auth Format

### Root Cause
The GOV.UK Fuel Finder API documentation states the OAuth token request must use:
- Content-Type: `application/x-www-form-urlencoded` (not JSON)
- Body: `grant_type=client_credentials&client_id=...&client_secret=...&scope=fuelfinder.read`

The current code sends JSON with only `client_id` and `client_secret`, which likely returns a malformed or empty token, causing the subsequent 403 errors on data endpoints.

### Fix
Update `getAccessToken()` in `supabase/functions/fuel-finder/index.ts`:

```typescript
const res = await fetch('https://www.fuel-finder.service.gov.uk/api/v1/oauth/generate_access_token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'fuelfinder.read',
  }).toString(),
});
```

Also add diagnostic logging to `fetchAllBatches` to capture the actual 403 response body if the issue persists.

### Files Changed
- `supabase/functions/fuel-finder/index.ts` — fix auth request format

