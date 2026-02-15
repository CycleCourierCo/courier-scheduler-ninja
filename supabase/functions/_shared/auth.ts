import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface AuthResult {
  success: boolean;
  userId?: string;
  authType?: 'admin' | 'cron' | 'user';
  error?: string;
  status?: number;
}

/**
 * Require basic authentication via JWT (any authenticated user)
 * Validates token but does NOT check for admin role
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
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

  return { success: true, userId: user.id, authType: 'user' };
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
 * Retrieves expected secret from Supabase Vault via get_cron_secret RPC
 * Falls back to admin JWT auth if cron secret is invalid or vault is unavailable
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
 * Require admin OR route_planner authentication via JWT
 * Validates token and checks for admin or route_planner role
 */
export async function requireAdminOrRoutePlannerAuth(req: Request): Promise<AuthResult> {
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

  if (isAdmin) {
    return { success: true, userId: user.id, authType: 'admin' };
  }

  const { data: isRoutePlanner } = await supabaseAdmin.rpc('has_role', {
    _user_id: user.id,
    _role: 'route_planner'
  });

  if (isRoutePlanner) {
    return { success: true, userId: user.id, authType: 'user' };
  }

  console.error('Auth failed: User is not admin or route_planner', {
    timestamp: new Date().toISOString(),
    userId: user.id,
  });
  return { success: false, error: 'Forbidden: Admin or route planner access required', status: 403 };
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
