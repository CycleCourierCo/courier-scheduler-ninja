
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.29.0'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''

interface EmailPayload {
  to: string
  name: string
  orderId: string
  baseUrl: string
  emailType: 'sender' | 'receiver'
  item?: {
    name: string
    quantity: number
    price: number
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: EmailPayload = await req.json()
    
    if (!payload.to || !payload.orderId || !payload.baseUrl || !payload.emailType) {
      return new Response(
        JSON.stringify({ error: 'Missing required email parameters' }),
        { 
          status: 400, 
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    // Extract item details if provided
    const itemName = payload.item?.name || 'Bike'
    const itemQuantity = payload.item?.quantity || 1
    
    let emailContent = ''
    let emailSubject = ''
    let callToActionUrl = ''
    
    if (payload.emailType === 'sender') {
      callToActionUrl = `${payload.baseUrl}/sender-availability/${payload.orderId}`
      emailSubject = `Please confirm collection dates for your ${itemName}`
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${payload.name || 'there'},</h2>
          <p>Thank you for choosing our bicycle courier service.</p>
          <p>We need to schedule a collection for your ${itemName}. Please click the button below to select dates when you'll be available for collection.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${callToActionUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Select Collection Dates</a>
          </div>
          <p>This link will expire in 7 days.</p>
          <p>If you have any questions, please contact our support team.</p>
          <p>Thank you,<br>Your Bicycle Courier Team</p>
        </div>
      `
    } else if (payload.emailType === 'receiver') {
      callToActionUrl = `${payload.baseUrl}/receiver-availability/${payload.orderId}`
      emailSubject = `Please confirm delivery dates for your ${itemName}`
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${payload.name || 'there'},</h2>
          <p>We have a bicycle delivery scheduled for you.</p>
          <p>The sender has selected their available dates for collection. Now we need to schedule the delivery of your ${itemName}. Please click the button below to select dates when you'll be available to receive the delivery.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${callToActionUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Select Delivery Dates</a>
          </div>
          <p>This link will expire in 7 days.</p>
          <p>If you have any questions, please contact our support team.</p>
          <p>Thank you,<br>Your Bicycle Courier Team</p>
        </div>
      `
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid email type' }),
        { 
          status: 400, 
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Bicycle Courier <courier@resend.dev>',
        to: payload.to,
        subject: emailSubject,
        html: emailContent,
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Error sending email:', data)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: data }),
        { 
          status: response.status, 
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        data
      }),
      { 
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    )

  } catch (error) {
    console.error('Error processing request:', error)
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    )
  }
})
