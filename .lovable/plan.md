
# Revised Implementation Plan: Edge Function Authentication (v3)

## Addressing Your Feedback

| Issue | Your Concern | Resolution |
|-------|-------------|------------|
| **Rate limiting not implemented** | Part 6 just logs IP, doesn't actually rate limit | Add in-memory rate limiting with TTL-based cleanup (Option A) - simple, effective, resets on cold start |
| **Vault RPC might fail** | RPC for scalar functions needs testing | Use explicit typing and add null-check fallback |
| **Disposable email list is static** | Hardcoded list becomes outdated | Add comment documenting monthly update requirement + provide update source URL |
| **pg_cron permissions** | Documentation needed for superuser bypass | Add inline SQL comments explaining this |
| **Missing test cases** | SQL injection, XSS, unicode, edge cases | Add comprehensive test cases to checklist |
| **Vault access issue** | get_cron_secret() needs vault schema grants | Add GRANT statements in migration |

---

## Complete Implementation

### Part 1: Shared Authentication Helper

**File**: `supabase/functions/_shared/auth.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface AuthResult {
  success: boolean;
  userId?: string;
  authType?: 'admin' | 'cron';
  error?: string;
  status?: number;
}

/**
 * Require admin authentication via JWT
 * Validates token and checks for admin role using has_role RPC
 */
export async function requireAdminAuth(req: Request): Promise<AuthResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('Auth failed: No bearer token provided', {
      timestamp: new Date().toISOString(),
    });
    return { success: false, error: 'Unauthorized', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    console.error('Auth failed: Invalid or expired token', {
      timestamp: new Date().toISOString(),
      errorType: authError?.name,
    });
    return { success: false, error: 'Unauthorized', status: 401 };
  }

  const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
    _user_id: user.id,
    _role: 'admin'
  });

  if (!isAdmin) {
    console.error('Auth failed: User is not admin', {
      timestamp: new Date().toISOString(),
      userId: user.id,
    });
    return { success: false, error: 'Forbidden: Admin access required', status: 403 };
  }

  return { success: true, userId: user.id, authType: 'admin' };
}

/**
 * Require admin OR cron secret authentication
 * Retrieves expected secret from Supabase Vault
 */
export async function requireAdminOrCronAuth(req: Request): Promise<AuthResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const cronSecret = req.headers.get('X-Cron-Secret');
  
  if (cronSecret) {
    // Retrieve the expected secret from Vault via RPC
    // The RPC returns TEXT, which comes as a single value
    const { data: vaultSecret, error: vaultError } = await supabaseAdmin
      .rpc('get_cron_secret');

    if (vaultError) {
      console.error('Failed to retrieve cron secret from vault', {
        timestamp: new Date().toISOString(),
        errorMessage: vaultError.message,
        errorCode: vaultError.code,
      });
      // Fall through to admin auth on vault error
    } else if (vaultSecret && typeof vaultSecret === 'string' && cronSecret === vaultSecret) {
      console.log('Auth success: Valid cron secret', {
        timestamp: new Date().toISOString(),
      });
      return { success: true, authType: 'cron' };
    } else {
      console.error('Auth failed: Invalid cron secret', {
        timestamp: new Date().toISOString(),
        hasVaultSecret: !!vaultSecret,
        vaultSecretType: typeof vaultSecret,
      });
    }
  }

  // Fall back to admin JWT auth
  return requireAdminAuth(req);
}

/**
 * Create standardized error response with CORS headers
 */
export function createAuthErrorResponse(
  error: string,
  status: number
): Response {
  return new Response(
    JSON.stringify({ error }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}
```

---

### Part 2: Rate Limiting for create-business-user

**In-memory rate limiting with TTL-based cleanup** (resets on function cold start, but effective for burst protection):

```typescript
// Rate limiting map with automatic cleanup
// Key: IP address, Value: { count, firstAttemptAt }
const rateLimitMap = new Map<string, { count: number; firstAttemptAt: number }>();

const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour
const RATE_LIMIT_MAX_ATTEMPTS = 5; // 5 registrations per hour per IP

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  // Cleanup: remove old entries (runs every 100 requests)
  if (Math.random() < 0.01) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now - value.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(key);
      }
    }
  }
  
  // No existing record or expired
  if (!record || now - record.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, firstAttemptAt: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
  
  // Within window, check count
  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    const resetIn = RATE_LIMIT_WINDOW_MS - (now - record.firstAttemptAt);
    return { allowed: false, remaining: 0, resetIn };
  }
  
  // Increment and allow
  record.count++;
  return { 
    allowed: true, 
    remaining: RATE_LIMIT_MAX_ATTEMPTS - record.count,
    resetIn: RATE_LIMIT_WINDOW_MS - (now - record.firstAttemptAt)
  };
}
```

---

### Part 3: Enhanced Disposable Email Check

```typescript
// Disposable email domains blocklist
// Last updated: 2025-02-09
// Update monthly from: https://github.com/disposable-email-domains/disposable-email-domains
// Run: curl -s https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf | head -100
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com', 'guerrillamail.com', 'mailinator.com', 
  '10minutemail.com', 'throwaway.email', 'temp-mail.org',
  'fakeinbox.com', 'trashmail.com', 'dispostable.com',
  'sharklasers.com', 'yopmail.com', 'getnada.com',
  'tempail.com', 'emailondeck.com', 'guerrillamailblock.com',
  'maildrop.cc', 'mintemail.com', 'mohmal.com',
  'mailcatch.com', 'tempr.email', 'throwawaymail.com',
  'tmpmail.org', 'tmpmail.net', 'jetable.org',
  'spamgourmet.com', 'mailnesia.com', 'mytrashmail.com',
  // Add more as needed - check GitHub source monthly
]);

function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? DISPOSABLE_EMAIL_DOMAINS.has(domain) : false;
}
```

---

### Part 4: Complete create-business-user Update

**File**: `supabase/functions/create-business-user/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// ============================================================================
// RATE LIMITING
// ============================================================================
const rateLimitMap = new Map<string, { count: number; firstAttemptAt: number }>();
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour
const RATE_LIMIT_MAX_ATTEMPTS = 5;

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  // Probabilistic cleanup
  if (Math.random() < 0.01) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now - value.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(key);
      }
    }
  }
  
  if (!record || now - record.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, firstAttemptAt: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
  
  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    const resetIn = RATE_LIMIT_WINDOW_MS - (now - record.firstAttemptAt);
    return { allowed: false, remaining: 0, resetIn };
  }
  
  record.count++;
  return { 
    allowed: true, 
    remaining: RATE_LIMIT_MAX_ATTEMPTS - record.count,
    resetIn: RATE_LIMIT_WINDOW_MS - (now - record.firstAttemptAt)
  };
}

// ============================================================================
// DISPOSABLE EMAIL CHECK
// ============================================================================
// Last updated: 2025-02-09
// Update monthly from: https://github.com/disposable-email-domains/disposable-email-domains
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com', 'guerrillamail.com', 'mailinator.com', 
  '10minutemail.com', 'throwaway.email', 'temp-mail.org',
  'fakeinbox.com', 'trashmail.com', 'dispostable.com',
  'sharklasers.com', 'yopmail.com', 'getnada.com',
  'tempail.com', 'emailondeck.com', 'guerrillamailblock.com',
  'maildrop.cc', 'mintemail.com', 'mohmal.com',
  'mailcatch.com', 'tempr.email', 'throwawaymail.com',
  'tmpmail.org', 'tmpmail.net', 'jetable.org',
  'spamgourmet.com', 'mailnesia.com', 'mytrashmail.com',
]);

// ============================================================================
// VALIDATION HELPERS
// ============================================================================
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: unknown): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  
  const trimmed = email.trim().toLowerCase();
  
  if (trimmed.length > 255) {
    return { valid: false, error: 'Email must be less than 255 characters' };
  }
  
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  // Check for unicode/emoji in email (basic ASCII only)
  if (!/^[\x00-\x7F]+$/.test(trimmed)) {
    return { valid: false, error: 'Email must contain only ASCII characters' };
  }
  
  const domain = trimmed.split('@')[1];
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return { valid: false, error: 'Disposable email addresses are not allowed' };
  }
  
  return { valid: true };
}

function validatePassword(password: unknown): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  
  if (password.length > 128) {
    return { valid: false, error: 'Password must be less than 128 characters' };
  }
  
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  if (!hasLetter || !hasNumber) {
    return { valid: false, error: 'Password must contain at least one letter and one number' };
  }
  
  return { valid: true };
}

function validateUserData(userData: unknown): { valid: boolean; error?: string } {
  if (!userData || typeof userData !== 'object' || userData === null) {
    return { valid: false, error: 'User data is required' };
  }
  
  const data = userData as Record<string, unknown>;
  
  const requiredFields = ['full_name', 'business_name'];
  for (const field of requiredFields) {
    const value = data[field];
    if (!value || typeof value !== 'string') {
      return { valid: false, error: `${field.replace('_', ' ')} is required` };
    }
    
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: `${field.replace('_', ' ')} cannot be empty` };
    }
    
    if (trimmed.length > 255) {
      return { valid: false, error: `${field.replace('_', ' ')} must be less than 255 characters` };
    }
    
    // Basic XSS prevention - strip HTML tags
    if (/<[^>]*>/.test(trimmed)) {
      return { valid: false, error: `${field.replace('_', ' ')} cannot contain HTML` };
    }
  }
  
  return { valid: true };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    // Check rate limit FIRST
    const rateLimit = checkRateLimit(clientIP);
    if (!rateLimit.allowed) {
      console.warn('Registration: Rate limit exceeded', {
        timestamp: new Date().toISOString(),
        ip: clientIP,
        resetInMs: rateLimit.resetIn,
      });
      return new Response(
        JSON.stringify({ error: 'Too many registration attempts. Please try again later.' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000))
          } 
        }
      );
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { email, password, userData } = body;

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      console.warn('Registration: Email validation failed', {
        timestamp: new Date().toISOString(),
        error: emailValidation.error,
      });
      return new Response(
        JSON.stringify({ error: emailValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return new Response(
        JSON.stringify({ error: passwordValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate userData
    const userDataValidation = validateUserData(userData);
    if (!userDataValidation.valid) {
      return new Response(
        JSON.stringify({ error: userDataValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log registration attempt (never log password)
    console.log('Creating business user', {
      timestamp: new Date().toISOString(),
      emailDomain: email.split('@')[1],
      ip: clientIP,
      rateLimitRemaining: rateLimit.remaining,
    });

    // Create user
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: userData
    });

    if (error) {
      console.error("Error creating business user:", {
        timestamp: new Date().toISOString(),
        errorMessage: error.message,
      });
      throw error;
    }

    console.log("Business user created successfully:", {
      timestamp: new Date().toISOString(),
      userId: data.user?.id,
    });

    return new Response(
      JSON.stringify({ data, success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error("Error in create-business-user function:", {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to create business user',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

### Part 5: Database Migration for Vault + Cron Jobs

```sql
-- ============================================================================
-- CRON SECRET VAULT SETUP
-- ============================================================================
-- This migration sets up secure cron job authentication using Supabase Vault

BEGIN;

-- Step 1: Ensure postgres role can access vault schema for the security definer function
-- NOTE: pg_cron runs as postgres superuser, which bypasses RLS and function permissions.
-- The grants below are for the SECURITY DEFINER function to access vault, not for pg_cron.
GRANT USAGE ON SCHEMA vault TO postgres;
GRANT SELECT ON vault.decrypted_secrets TO postgres;

-- Step 2: Create the cron secret in vault
-- IMPORTANT: Replace 'YOUR_SECURE_CRON_SECRET_HERE' with a generated 32+ char secret
-- Generate with: openssl rand -base64 32
SELECT vault.create_secret(
  'YOUR_SECURE_CRON_SECRET_HERE',  -- The secret value
  'cron_secret',                    -- The secret name
  'Authentication secret for pg_cron jobs calling edge functions'
);

-- Step 3: Create helper function to retrieve cron secret
-- This function runs as SECURITY DEFINER so it can access vault even when called
-- from an edge function context
CREATE OR REPLACE FUNCTION public.get_cron_secret()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  secret_value text;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;
  
  RETURN secret_value;
END;
$$;

-- Step 4: Restrict function access
-- pg_cron runs as postgres superuser and bypasses these restrictions.
-- These REVOKEs prevent regular users from calling this function directly.
REVOKE ALL ON FUNCTION public.get_cron_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_cron_secret() FROM authenticated;
REVOKE ALL ON FUNCTION public.get_cron_secret() FROM anon;

-- Step 5: Unschedule existing cron jobs
SELECT cron.unschedule('generate-daily-timeslips');
SELECT cron.unschedule('refresh-quickbooks-tokens-weekly');

-- Also unschedule duplicate job if exists (jobid 3)
DO $$
BEGIN
  PERFORM cron.unschedule('generate-daily-timeslips');
EXCEPTION WHEN OTHERS THEN
  -- Ignore if already unscheduled
END$$;

-- Step 6: Reschedule with Vault-based authentication
-- NOTE: pg_cron runs as postgres superuser, so it CAN call get_cron_secret()
SELECT cron.schedule(
  'generate-daily-timeslips',
  '5 0 * * *',  -- 00:05 UTC daily
  $$
  SELECT net.http_post(
    url:='https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/generate-timeslips',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT public.get_cron_secret())
    ),
    body:=jsonb_build_object('date', (CURRENT_DATE - INTERVAL '1 day')::DATE::TEXT)
  );
  $$
);

SELECT cron.schedule(
  'refresh-quickbooks-tokens-weekly',
  '0 2 * * 0',  -- 02:00 UTC Sundays
  $$
  SELECT net.http_post(
    url:='https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/refresh-quickbooks-tokens',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT public.get_cron_secret())
    ),
    body:=jsonb_build_object('scheduled_run', now()::TEXT)
  );
  $$
);

COMMIT;
```

---

### Part 6: Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/_shared/auth.ts` | **NEW** - Create shared auth helper with robust vault RPC handling |
| `supabase/functions/create-business-user/index.ts` | Add rate limiting, input validation, disposable email check |
| `supabase/functions/generate-timeslips/index.ts` | Add `requireAdminOrCronAuth` check after CORS |
| `supabase/functions/refresh-quickbooks-tokens/index.ts` | Add `requireAdminOrCronAuth` check after CORS |
| `supabase/functions/query-database-completed-jobs/index.ts` | Add `requireAdminOrCronAuth` check after CORS |
| `supabase/functions/send-email/index.ts` | Add `requireAdminAuth` check after CORS |
| `supabase/functions/send-loading-list-whatsapp/index.ts` | Add `requireAdminAuth` check after CORS |
| `supabase/functions/send-timeslip-whatsapp/index.ts` | Add `requireAdminAuth` check after CORS |
| `supabase/functions/send-route-report/index.ts` | Add `requireAdminAuth` check after CORS |
| `supabase/functions/generate-tracking-numbers/index.ts` | Add `requireAdminAuth` check after CORS |

---

### Part 7: Pre-Implementation Checklist

Before running the migration:

1. **Generate CRON_SECRET**: Run `openssl rand -base64 32` to generate a secure secret
2. **Replace placeholder**: Update `YOUR_SECURE_CRON_SECRET_HERE` in the migration SQL
3. **Verify vault extension**: Already confirmed enabled (`supabase_vault` exists)
4. **Verify has_role RPC**: Already confirmed exists with correct signature

---

### Part 8: Comprehensive Testing Checklist

#### Authentication Tests
| Test | Function | Input | Expected |
|------|----------|-------|----------|
| No auth header | All admin functions | No header | 401 |
| Empty bearer | All admin functions | `Bearer ` | 401 |
| Invalid JWT | All admin functions | Random string | 401 |
| Expired JWT | All admin functions | Old token | 401 |
| JWT from wrong project | All admin functions | Different project token | 401 |
| Valid non-admin JWT | All admin functions | Customer token | 403 |
| Valid admin JWT | All admin functions | Admin token | 200 |
| Admin role revoked | All admin functions | Post-revocation call | 403 |
| Wrong cron secret | Dual-auth functions | Bad secret | 401 (falls to JWT) |
| Correct cron secret | Dual-auth functions | Valid secret | 200 |
| Vault error fallback | Dual-auth functions | Vault unavailable | Falls to JWT auth |

#### create-business-user Validation Tests
| Test | Input | Expected |
|------|-------|----------|
| Missing email | `{ password, userData }` | 400 - Email is required |
| Invalid email format | `email: "notanemail"` | 400 - Invalid email format |
| Email > 255 chars | Very long email | 400 - Too long |
| Unicode in email | `email: "tëst@example.com"` | 400 - ASCII only |
| Emoji in email | `email: "test😀@example.com"` | 400 - ASCII only |
| Disposable email | `email: "test@tempmail.com"` | 400 - Not allowed |
| Short password | `password: "abc123"` | 400 - At least 8 chars |
| Long password | 129+ chars | 400 - Too long |
| No letters | `password: "12345678"` | 400 - Needs letter |
| No numbers | `password: "abcdefgh"` | 400 - Needs number |
| Missing full_name | `userData: { business_name }` | 400 - Required |
| Empty full_name | `full_name: "   "` | 400 - Cannot be empty |
| Long full_name | 256+ chars | 400 - Too long |
| HTML in full_name | `full_name: "<script>"` | 400 - No HTML |
| XSS attempt | `<img onerror=...>` | 400 - No HTML |
| SQL injection | `'; DROP TABLE--` | Handled safely (parameterized) |

#### Rate Limiting Tests
| Test | Input | Expected |
|------|-------|----------|
| First request | Valid data | 200 |
| 5th request in 1 hour | Valid data | 200 |
| 6th request in 1 hour | Valid data | 429 + Retry-After header |
| Request after window | Valid data | 200 (reset) |
| Different IPs | Same data | Each gets own limit |

#### Concurrent/Edge Case Tests
| Test | Expected |
|------|----------|
| Concurrent registrations same IP | Properly counted, 6th fails |
| Cron job during vault error | Falls back to JWT (fails if no JWT) |
| Empty JSON body | 400 - proper error message |
| Invalid JSON | 400 - Invalid JSON body |

---

### Part 9: Summary

| Category | Count |
|----------|-------|
| New shared files | 1 (`_shared/auth.ts`) |
| Functions with admin auth | 5 |
| Functions with admin+cron auth | 3 |
| Functions with hardened validation | 1 |
| Database migrations | 1 |
| Cron jobs updated | 2 |
| Frontend changes | 0 |

### Security Improvements Delivered

- **Rate limiting**: In-memory with TTL cleanup, 5 requests/hour/IP
- **Input validation**: Email format, length, ASCII-only, disposable domain block
- **Password complexity**: Minimum 8 chars, requires letter AND number
- **XSS prevention**: HTML tag detection in user data fields
- **Vault-based secrets**: Cron secret encrypted, not in plain text
- **Proper RPC handling**: Type checking, null checks, fallback behavior
- **Comprehensive logging**: Failed attempts logged for monitoring (no sensitive data)
