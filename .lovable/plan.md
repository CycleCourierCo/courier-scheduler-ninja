

# Plan: Fix Stack Trace Exposure in Edge Functions

## Summary

Remove the `details` field from error responses in 6 Supabase Edge Functions to prevent exposing internal stack traces and error objects to API consumers. The `console.error` statements will be retained for server-side debugging.

## Why This Matters

When error objects or stack traces are included in HTTP responses:
- Internal file paths and function names are exposed
- Database query structures may be revealed
- Third-party API details could leak
- Attackers can use this information to craft targeted attacks

## Files to Modify

### 1. supabase/functions/send-timeslot-whatsapp/index.ts (Lines 611-616)

**Current:**
```typescript
return new Response(
  JSON.stringify({
    success: false,
    error: error?.message || "Unexpected error occurred",
    details: error,  // <-- REMOVE
  }),
```

**Change to:**
```typescript
return new Response(
  JSON.stringify({
    success: false,
    error: error?.message || "Unexpected error occurred",
  }),
```

### 2. supabase/functions/send-loading-list-whatsapp/index.ts (Lines 744-748)

**Current:**
```typescript
return new Response(
  JSON.stringify({ 
    error: error.message || 'Failed to send loading list',
    details: error  // <-- REMOVE
  }),
```

**Change to:**
```typescript
return new Response(
  JSON.stringify({ 
    error: error.message || 'Failed to send loading list'
  }),
```

### 3. supabase/functions/send-timeslip-whatsapp/index.ts (Lines 79-83)

**Current:**
```typescript
return new Response(
  JSON.stringify({ 
    error: error.message || 'Failed to send timeslip',
    details: error  // <-- REMOVE
  }),
```

**Change to:**
```typescript
return new Response(
  JSON.stringify({ 
    error: error.message || 'Failed to send timeslip'
  }),
```

### 4. supabase/functions/generate-timeslips/index.ts (Lines 512-517)

**Current:**
```typescript
return new Response(
  JSON.stringify({ 
    error: error.message || 'Failed to generate timeslips',
    details: error.stack,  // <-- REMOVE
    executionTime: executionTime
  }),
```

**Change to:**
```typescript
return new Response(
  JSON.stringify({ 
    error: error.message || 'Failed to generate timeslips',
    executionTime: executionTime
  }),
```

### 5. supabase/functions/query-shipday-completed-orders/index.ts (Lines 249-253)

**Current:**
```typescript
return new Response(
  JSON.stringify({ 
    error: error.message || 'Failed to query Shipday orders',
    details: error  // <-- REMOVE
  }),
```

**Change to:**
```typescript
return new Response(
  JSON.stringify({ 
    error: error.message || 'Failed to query Shipday orders'
  }),
```

### 6. supabase/functions/query-database-completed-jobs/index.ts (Lines 208-212)

**Current:**
```typescript
return new Response(
  JSON.stringify({ 
    error: error.message || 'Failed to query completed jobs',
    details: error.stack  // <-- REMOVE
  }),
```

**Change to:**
```typescript
return new Response(
  JSON.stringify({ 
    error: error.message || 'Failed to query completed jobs'
  }),
```

## Technical Details

### What We Keep
- `console.error()` statements remain for server-side logging in Supabase dashboard
- Human-readable `error.message` in responses for debugging on the client side
- `executionTime` in generate-timeslips (non-sensitive operational metric)

### What We Remove
- `details: error` - serializes the entire error object including stack trace
- `details: error.stack` - directly exposes the stack trace

### Security Best Practice
Log full errors server-side, return only generic messages to clients:
```typescript
// Server-side (keep)
console.error('Error in function:', error);

// Client response (sanitized)
JSON.stringify({ error: error.message || 'Generic error message' })
```

## Deployment

Changes will be deployed automatically when the edge functions are updated. No additional configuration needed.

