import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify cron secret
    const { data: storedSecret } = await adminClient.rpc('get_cron_secret');
    if (!cronSecret || cronSecret !== storedSecret) {
      console.error('Invalid cron secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find pending announcements that are due
    const { data: dueAnnouncements, error: fetchError } = await adminClient
      .from('scheduled_announcements')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching scheduled announcements:', fetchError);
      throw fetchError;
    }

    if (!dueAnnouncements || dueAnnouncements.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending announcements' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Processing ${dueAnnouncements.length} scheduled announcement(s)`);

    for (const announcement of dueAnnouncements) {
      try {
        // Resolve recipients
        let recipientEmails: string[] = [];

        if (announcement.recipient_mode === 'individual' && announcement.recipient_ids?.length > 0) {
          const { data: profiles } = await adminClient
            .from('profiles')
            .select('email')
            .in('id', announcement.recipient_ids)
            .not('email', 'is', null);
          recipientEmails = (profiles || []).map((p: any) => p.email).filter(Boolean);
        } else if (announcement.recipient_mode === 'role' && announcement.recipient_roles?.length > 0) {
          const { data: profiles } = await adminClient
            .from('profiles')
            .select('email, role')
            .eq('account_status', 'approved')
            .not('email', 'is', null);
          recipientEmails = (profiles || [])
            .filter((p: any) => announcement.recipient_roles.includes(p.role))
            .map((p: any) => p.email)
            .filter(Boolean);
        }

        // Deduplicate
        recipientEmails = [...new Set(recipientEmails.map((e: string) => e.toLowerCase()))];

        if (recipientEmails.length === 0) {
          await adminClient
            .from('scheduled_announcements')
            .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: 'No valid recipients found' })
            .eq('id', announcement.id);
          continue;
        }

        console.log(`Sending announcement "${announcement.subject}" to ${recipientEmails.length} recipients`);

        let successCount = 0;
        let failCount = 0;

        for (const email of recipientEmails) {
          try {
            const { error } = await adminClient.functions.invoke('send-email', {
              body: {
                to: email,
                subject: announcement.subject,
                html: announcement.html_body,
                text: announcement.html_body.replace(/<[^>]*>/g, ''),
              },
            });
            if (error) throw error;
            successCount++;
          } catch (err) {
            console.error(`Failed to send to ${email}:`, err);
            failCount++;
          }
          // Stagger sends
          if (recipientEmails.indexOf(email) < recipientEmails.length - 1) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        const errorMsg = failCount > 0 ? `${failCount} of ${recipientEmails.length} failed` : null;
        await adminClient
          .from('scheduled_announcements')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: errorMsg,
          })
          .eq('id', announcement.id);

        console.log(`Announcement ${announcement.id}: sent ${successCount}, failed ${failCount}`);
      } catch (err) {
        console.error(`Error processing announcement ${announcement.id}:`, err);
        await adminClient
          .from('scheduled_announcements')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: err instanceof Error ? err.message : 'Unknown error',
          })
          .eq('id', announcement.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: dueAnnouncements.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in process-scheduled-announcements:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
