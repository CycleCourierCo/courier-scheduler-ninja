import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TimeslipRequest {
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message }: TimeslipRequest = await req.json();

    // Always send to this specific number for timeslips
    const phoneNumber = '+441217980767';
    
    console.log('Sending timeslip to:', phoneNumber);

    // Get API credentials from environment
    const apiKey = Deno.env.get('TWOCHAT_API_KEY');
    const fromNumber = Deno.env.get('TWOCHAT_FROM_NUMBER');

    if (!apiKey || !fromNumber) {
      console.error('Missing WhatsApp API credentials');
      return new Response(
        JSON.stringify({ error: 'WhatsApp API not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Clean phone number (remove + and non-digits)
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');

    // Send WhatsApp message via 2Chat API
    const whatsappResponse = await fetch('https://api.p.2chat.io/open/whatsapp/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-API-Key': apiKey,
      },
      body: JSON.stringify({
        to_number: `+${cleanPhone}`,
        from_number: fromNumber,
        text: message
      }),
    });

    const whatsappResult = await whatsappResponse.json();
    console.log('WhatsApp API response:', whatsappResult);

    if (!whatsappResponse.ok) {
      throw new Error(`WhatsApp API error: ${JSON.stringify(whatsappResult)}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Timeslip sent successfully',
        whatsappResult 
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in send-timeslip-whatsapp function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send timeslip',
        details: error 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);