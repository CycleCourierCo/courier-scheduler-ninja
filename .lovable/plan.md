
# Plan: Fix Sensitive Data Logging in Edge Functions

## Summary

Remove or sanitize all console.log statements that expose sensitive information (API keys, secrets, tokens) in Supabase Edge Functions. These logs persist in the Supabase dashboard and could be accessed by attackers who gain access to the logs.

## Files to Modify

### 1. supabase/functions/orders/index.ts

**Current Issues:**
- Line 59: Logs first 20 characters of API key
- Line 61: Logs userId and full error object (may contain sensitive details)
- Line 64: Logs userId in error case

**Changes:**
```typescript
// Line 59 - Replace:
console.log('Received API key:', apiKey?.substring(0, 20) + '...')
// With:
console.log('API key received, verifying...')

// Line 61 - Replace:
console.log('verify_api_key result - userId:', userId, 'error:', keyError)
// With:
console.log('API key verification:', userId ? 'success' : 'failed')

// Line 64 - Replace:
console.error('API key verification failed:', userId)
// With:
console.error('API key verification failed')
```

### 2. supabase/functions/create-webhook-config/index.ts

**Current Issue:**
- Line 119: Logs secretId and vaultKey which could be used to access the webhook secret

**Changes:**
```typescript
// Line 119 - Replace:
console.log('Webhook secret stored in vault:', { secretId, vaultKey })
// With:
console.log('Webhook secret stored in vault successfully')
```

## Files Reviewed but No Changes Needed

The following files were reviewed and their logging is acceptable:

- **refresh-quickbooks-tokens/index.ts**: Logs user IDs (not secrets) and token refresh status - acceptable
- **create-quickbooks-invoice/index.ts**: Logs token refresh status - acceptable  
- **create-quickbooks-bill/index.ts**: Logs token expiry status - acceptable
- **send-loading-list-whatsapp/index.ts**: Logs that API key is not configured - acceptable
- **create-shipday-order/index.ts**: Logs API response status/body - acceptable (responses, not keys)
- **shopify-webhook/index.ts**: Logs order data - acceptable (business data, not credentials)

## Technical Details

### Why This Matters
- Edge functions run in Deno on Supabase infrastructure
- The `vite-plugin-remove-console` only affects frontend builds via Vite
- Edge function logs persist in the Supabase dashboard and are accessible to anyone with project access
- Partial key exposure (20 characters) significantly reduces brute-force keyspace

### Logging Best Practices Applied
1. Log the **action** being performed, not the **credential**
2. Log **success/failure status**, not the **data** used
3. Use generic identifiers when needed (e.g., "user authenticated" vs logging user tokens)

## Deployment

Changes will be deployed automatically when the edge functions are updated. No additional configuration needed.
