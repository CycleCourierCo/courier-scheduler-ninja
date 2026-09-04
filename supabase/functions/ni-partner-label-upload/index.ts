import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'
import { CITY_AIR_EXPRESS } from '../_shared/northernIreland.ts'
import { sanitizeFileName } from '../_shared/sanitizeFileName.ts'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const admin = createClient(supabaseUrl, serviceKey)

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return json({ error: 'Expected multipart/form-data upload' }, 400)
    }

    const form = await req.formData()
    const orderId = (form.get('orderId') as string) || ''
    const bfsNumber = (form.get('bfsNumber') as string) || ''
    const file = form.get('label') as File | null

    if (!orderId || typeof orderId !== 'string') {
      return json({ error: 'orderId is required' }, 400)
    }

    // Only validate the order is a Northern Ireland order. The order UUID is the secret.
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, is_northern_ireland, ni_bfs_number, ni_partner_label_url')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError) {
      console.error('Order lookup failed:', orderError.message)
      return json({ error: 'Could not load this order' }, 500)
    }
    if (!order) {
      return json({ error: 'Order not found' }, 404)
    }
    if (!order.is_northern_ireland) {
      return json({ error: 'This order is not a Northern Ireland order' }, 400)
    }

    let savedLabelUrl: string | null = null

    if (file && file.size > 0) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return json(
          { error: 'Label must be a PDF, PNG, JPEG or WebP image' },
          400,
        )
      }
      if (file.size > MAX_BYTES) {
        return json({ error: 'Label must be under 10 MB' }, 400)
      }

      const extension = file.type === 'application/pdf'
        ? 'pdf'
        : file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
        ? 'webp'
        : 'jpg'
      const fileName = sanitizeFileName(file.name) || `label.${extension}`
      const path = `partner/${orderId}/${crypto.randomUUID().slice(0, 8)}-${fileName}`

      const { error: uploadError } = await admin.storage
        .from('foam-my-bike-labels')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (uploadError) {
        console.error('Partner label upload failed:', uploadError.message)
        return json({ error: 'Upload failed — please try again' }, 502)
      }

      savedLabelUrl = path
    }

    const submitBfs = bfsNumber?.trim() || null
    const submitLabel = savedLabelUrl || null

    const { data: submitResult, error: submitError } = await admin.rpc(
      'submit_ni_partner_details',
      {
        p_order_id: orderId,
        p_bfs_number: submitBfs,
        p_label_url: submitLabel,
      },
    )

    if (submitError) {
      console.error('submit_ni_partner_details failed:', submitError.message)
      return json({ error: 'Could not save the partner details' }, 502)
    }

    if ((submitResult as any)?.success !== true) {
      return json({ error: (submitResult as any)?.error || 'Update rejected' }, 400)
    }

    return json({
      success: true,
      bfsNumber: submitBfs || order.ni_bfs_number,
      labelUrl: submitLabel || order.ni_partner_label_url,
      cityAirExpressEmail: CITY_AIR_EXPRESS.email,
    })
  } catch (e) {
    console.error('ni-partner-label-upload failed:', (e as Error)?.message)
    return json({ error: 'Unexpected error' }, 500)
  }
})
