import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create client with service role for admin operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get the authenticated user from the request
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user is admin or sales
    const [{ data: isAdmin }, { data: isSales }] = await Promise.all([
      supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
      supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'sales' }),
    ]);

    if (!isAdmin && !isSales) {
      console.error('User lacks user-management privilege:', user.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin or Sales access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, userId, role, roles } = await req.json();

    // Sales users may only assign customer-tier roles. All elevated roles require admin.
    const SALES_ASSIGNABLE = new Set(['b2b_customer', 'b2c_customer']);
    const assertAssignable = (rs: string[]): string | null => {
      if (isAdmin) return null;
      const bad = rs.find((r) => !SALES_ASSIGNABLE.has(r));
      return bad ? `Sales users cannot assign role: ${bad}` : null;
    };

    // Priority order for picking a "primary" role to mirror onto profiles.role
    const ROLE_PRIORITY = ['admin','route_planner','loader','mechanic','sales','driver','b2b_customer','b2c_customer'];
    const pickPrimary = (rs: string[]) =>
      ROLE_PRIORITY.find(r => rs.includes(r)) ?? rs[0];

    if (action === 'setMany') {
      if (!Array.isArray(roles) || roles.length === 0) {
        return new Response(
          JSON.stringify({ error: 'roles array required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const uniqueRoles = Array.from(new Set(roles)) as string[];
      const denied = assertAssignable(uniqueRoles);
      if (denied) {
        return new Response(
          JSON.stringify({ error: denied }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: deleteError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabaseAdmin
        .from('user_roles')
        .insert(uniqueRoles.map((r: string) => ({ user_id: userId, role: r })));
      if (insertError) throw insertError;

      const primary = pickPrimary(uniqueRoles);
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ role: primary })
        .eq('id', userId);
      if (profileError) throw profileError;

      return new Response(
        JSON.stringify({ success: true, roles: uniqueRoles, primary }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'set') {
      // Remove existing roles for this user
      const { error: deleteError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error deleting existing roles:', deleteError);
        throw deleteError;
      }

      // Insert new role
      const { error: insertError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (insertError) {
        console.error('Error inserting new role:', insertError);
        throw insertError;
      }

      // Also update the profiles table for backward compatibility
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ role })
        .eq('id', userId);

      if (profileError) {
        console.error('Error updating profile role:', profileError);
        throw profileError;
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Role updated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in manage-user-roles function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
