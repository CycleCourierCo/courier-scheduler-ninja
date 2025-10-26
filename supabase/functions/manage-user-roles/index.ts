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

    // Verify the user is an admin
    const { data: isAdmin } = await supabaseAdmin.rpc('is_admin');
    
    if (!isAdmin) {
      console.error('User is not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, userId, role } = await req.json();

    console.log('Managing user role:', { action, userId, role });

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
