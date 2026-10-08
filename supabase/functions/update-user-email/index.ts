import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return json({ error: 'Forbidden: Admin access required' }, 403);

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!userId) return json({ error: 'userId is required' }, 400);
    if (!EMAIL_RE.test(email)) return json({ error: 'A valid email address is required' }, 400);

    // Reject if another auth user already has this email
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .neq('id', userId)
      .limit(1);
    if (existing && existing.length > 0) {
      return json({ error: 'That email is already used by another account' }, 409);
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    });
    if (updateError) {
      const msg = updateError.message || '';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
        return json({ error: 'That email is already used by another account' }, 409);
      }
      console.error('Auth email update failed:', msg);
      return json({ error: 'Failed to update the login email' }, 502);
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ email })
      .eq('id', userId);
    if (profileError) {
      console.error('Profile email sync failed:', profileError.message);
      return json({ error: 'Login email changed but the profile email failed to sync' }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error('update-user-email failed:', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Failed to update the login email' }, 500);
  }
});
