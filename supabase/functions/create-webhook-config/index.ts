import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'

interface WebhookRequest {
  user_id: string
  name: string
  endpoint_url: string
  events: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get auth token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize Supabase client with user's token for auth check
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify user is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can create webhooks' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request body
    const { user_id, name, endpoint_url, events }: WebhookRequest = await req.json()

    // Validate inputs
    if (!user_id || !name || !endpoint_url || !events || events.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate HTTPS URL
    try {
      const url = new URL(endpoint_url)
      if (url.protocol !== 'https:') {
        return new Response(JSON.stringify({ error: 'Endpoint URL must use HTTPS' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Use service role client for vault operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Generate webhook secret
    const configId = crypto.randomUUID()
    const randomKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const prefix = `wh_${user_id.substring(0, 8)}`
    const fullSecret = `${prefix}_${randomKey}`
    
    // Hash the secret
    const encoder = new TextEncoder()
    const data = encoder.encode(fullSecret)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const secretHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Store plaintext secret in Vault
    const vaultKey = `webhook_secret_${configId}`
    const { error: vaultError } = await supabaseAdmin
      .from('vault.secrets')
      .insert({ name: vaultKey, secret: fullSecret })

    if (vaultError) {
      console.error('Vault error:', vaultError)
      return new Response(JSON.stringify({ error: 'Failed to store webhook secret' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Insert webhook configuration
    const { error: configError } = await supabaseAdmin
      .from('webhook_configurations')
      .insert({
        id: configId,
        user_id: user_id,
        name: name,
        endpoint_url: endpoint_url,
        secret_hash: secretHash,
        secret_prefix: prefix,
        events: events
      })

    if (configError) {
      console.error('Config error:', configError)
      // Try to cleanup vault secret
      await supabaseAdmin.from('vault.secrets').delete().eq('name', vaultKey)
      
      return new Response(JSON.stringify({ error: 'Failed to create webhook configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Webhook created successfully:', { configId, userId: user_id, name })

    return new Response(JSON.stringify({ 
      webhook_secret: fullSecret,
      config_id: configId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
