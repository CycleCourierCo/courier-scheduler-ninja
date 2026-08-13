import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'
import { buildFerryPartnerEmail } from '../_shared/ferryPartnerEmail.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization') || ''
    const isCron = req.headers.get('X-Cron-Secret')
    let internal = false

    if (!isCron) {
      if (!authHeader) return json({ error: 'Not authenticated' }, 401)
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: userData } = await userClient.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) return json({ error: 'Not authenticated' }, 401)
      const { data: staff } = await userClient.rpc('is_internal_staff', { _user_id: userId })
      internal = staff === true
      if (!internal) return json({ error: 'Not authorised' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const orderId = body?.orderId
    if (!orderId || typeof orderId !== 'string') {
      return json({ error: 'orderId is required' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: order, error } = await admin
      .from('orders')
      .select(
        'id, sender, receiver, tracking_number, bike_brand, bike_model, bike_quantity, is_northern_ireland, ni_direction'
      )
      .eq('id', orderId)
      .maybeSingle()

    if (error) return json({ error: 'Could not load the order' }, 500)
    if (!order) return json({ error: 'Order not found' }, 404)
    if (!order.is_northern_ireland) {
      return json({ error: 'This order is not flagged as a Northern Ireland order' }, 400)
    }

    const email = buildFerryPartnerEmail(order as any)

    const { error: emailError } = await admin.functions.invoke('send-email', {
      body: {
        to: email.to,
        subject: email.subject,
        html: email.html,
        from: 'CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>',
        reply_to: 'Info@cyclecourierco.com',
      },
    })

    if (emailError) {
      console.error('Ferry partner email failed to send:', emailError.message)
      return json({ error: 'The email could not be sent' }, 502)
    }

    const notifiedAt = new Date().toISOString()
    await admin.from('orders').update({ ferry_partner_notified_at: notifiedAt }).eq('id', orderId)

    return json({ success: true, to: email.to, direction: email.direction, notifiedAt })
  } catch (e) {
    console.error('send-ferry-partner-notification failed:', (e as Error)?.message)
    return json({ error: 'Unexpected error' }, 500)
  }
})
