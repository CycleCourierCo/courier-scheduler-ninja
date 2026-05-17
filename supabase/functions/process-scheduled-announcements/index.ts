import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

const BRAND = {
  name: "Cycle Courier Co.",
  legalName: "Cycorco Ltd trading as Cycle Courier Co.",
  address: "30 Wake Green Road, Birmingham, B13 9PB",
  companyNo: "16220087",
  vatNo: "GB507727188",
  email: "info@cyclecourierco.com",
  phone: "+44 121 798 0767",
  website: "https://booking.cyclecourierco.com",
  primary: "#0F766E",
  primaryDark: "#0B5A53",
  text: "#1f2937",
  muted: "#6b7280",
  border: "#e5e7eb",
  bg: "#f4f6f8",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function normaliseBody(input: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  const looksLikeHtml = /<\s*(p|div|h[1-6]|ul|ol|table|section|article|br|img|a)\b/i.test(trimmed);
  if (looksLikeHtml) return trimmed;
  return trimmed
    .split(/\n\s*\n/)
    .map(
      (para) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.text};">${escapeHtml(para).replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

function buildPlainText(content: string): string {
  return (content || "")
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapAnnouncementEmail(content: string, subject: string): string {
  const bodyHtml = normaliseBody(content);
  const safeSubject = escapeHtml(subject || "");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeSubject}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BRAND.border};">
<tr><td style="background:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryDark});padding:24px 32px;color:#ffffff;font-size:20px;font-weight:700;">${BRAND.name}</td></tr>
<tr><td style="padding:32px;"><h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:${BRAND.text};font-weight:700;">${safeSubject}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:0 32px;"><div style="height:1px;background:${BRAND.border};"></div></td></tr>
<tr><td style="padding:20px 32px;font-size:13px;color:${BRAND.muted};">Need help? Email <a href="mailto:${BRAND.email}" style="color:${BRAND.primary};text-decoration:none;">${BRAND.email}</a> or call <a href="tel:${BRAND.phone.replace(/\s+/g, "")}" style="color:${BRAND.primary};text-decoration:none;">${BRAND.phone}</a>.</td></tr>
<tr><td style="background:#fafafa;padding:20px 32px;font-size:11px;line-height:1.5;color:${BRAND.muted};text-align:center;">
<div style="margin-bottom:6px;"><a href="${BRAND.website}" style="color:${BRAND.primary};text-decoration:none;font-weight:600;">${BRAND.website.replace(/^https?:\/\//, "")}</a></div>
${BRAND.legalName}<br>Registered office: ${BRAND.address}<br>Company No: ${BRAND.companyNo} &middot; VAT No: ${BRAND.vatNo}
</td></tr></table>
<div style="max-width:600px;margin:12px auto 0;font-size:11px;color:${BRAND.muted};text-align:center;">You're receiving this email because you have an account with ${BRAND.name}.</div>
</td></tr></table></body></html>`;
}

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
            const brandedHtml = wrapAnnouncementEmail(announcement.html_body, announcement.subject);
            const { error } = await adminClient.functions.invoke('send-email', {
              body: {
                to: email,
                subject: announcement.subject,
                html: brandedHtml,
                text: buildPlainText(announcement.html_body),
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
