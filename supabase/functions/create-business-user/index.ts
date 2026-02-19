import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { Resend } from "npm:resend@4.1.2";
import { initSentry, captureException, startSpan } from "../_shared/sentry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// ============================================================================
// RATE LIMITING
// In-memory rate limiting with TTL-based cleanup
// Resets on function cold start, but effective for burst protection
// ============================================================================
const rateLimitMap = new Map<string, { count: number; firstAttemptAt: number }>();
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour
const RATE_LIMIT_MAX_ATTEMPTS = 5;

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  // Probabilistic cleanup (runs every ~100 requests)
  if (Math.random() < 0.01) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now - value.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(key);
      }
    }
  }
  
  if (!record || now - record.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, firstAttemptAt: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
  
  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    const resetIn = RATE_LIMIT_WINDOW_MS - (now - record.firstAttemptAt);
    return { allowed: false, remaining: 0, resetIn };
  }
  
  record.count++;
  return { 
    allowed: true, 
    remaining: RATE_LIMIT_MAX_ATTEMPTS - record.count,
    resetIn: RATE_LIMIT_WINDOW_MS - (now - record.firstAttemptAt)
  };
}

// ============================================================================
// DISPOSABLE EMAIL CHECK
// Last updated: 2025-02-09
// Update monthly from: https://github.com/disposable-email-domains/disposable-email-domains
// Run: curl -s https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf | head -100
// ============================================================================
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com', 'guerrillamail.com', 'mailinator.com', 
  '10minutemail.com', 'throwaway.email', 'temp-mail.org',
  'fakeinbox.com', 'trashmail.com', 'dispostable.com',
  'sharklasers.com', 'yopmail.com', 'getnada.com',
  'tempail.com', 'emailondeck.com', 'guerrillamailblock.com',
  'maildrop.cc', 'mintemail.com', 'mohmal.com',
  'mailcatch.com', 'tempr.email', 'throwawaymail.com',
  'tmpmail.org', 'tmpmail.net', 'jetable.org',
  'spamgourmet.com', 'mailnesia.com', 'mytrashmail.com',
]);

// ============================================================================
// VALIDATION HELPERS
// ============================================================================
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: unknown): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  
  const trimmed = email.trim().toLowerCase();
  
  if (trimmed.length > 255) {
    return { valid: false, error: 'Email must be less than 255 characters' };
  }
  
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  // Check for unicode/emoji in email (basic ASCII only)
  if (!/^[\x00-\x7F]+$/.test(trimmed)) {
    return { valid: false, error: 'Email must contain only ASCII characters' };
  }
  
  const domain = trimmed.split('@')[1];
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return { valid: false, error: 'Disposable email addresses are not allowed' };
  }
  
  return { valid: true };
}

function validatePassword(password: unknown): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  
  if (password.length > 128) {
    return { valid: false, error: 'Password must be less than 128 characters' };
  }
  
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  if (!hasLetter || !hasNumber) {
    return { valid: false, error: 'Password must contain at least one letter and one number' };
  }
  
  return { valid: true };
}

function validateUserData(userData: unknown): { valid: boolean; error?: string } {
  if (!userData || typeof userData !== 'object' || userData === null) {
    return { valid: false, error: 'User data is required' };
  }
  
  const data = userData as Record<string, unknown>;
  
  // Check name field (used by handle_new_user trigger)
  if (data.name !== undefined) {
    if (typeof data.name !== 'string') {
      return { valid: false, error: 'Name must be a string' };
    }
    
    const trimmedName = data.name.trim();
    if (trimmedName.length === 0) {
      return { valid: false, error: 'Name cannot be empty' };
    }
    
    if (trimmedName.length > 255) {
      return { valid: false, error: 'Name must be less than 255 characters' };
    }
    
    // Basic XSS prevention - reject HTML tags
    if (/<[^>]*>/.test(trimmedName)) {
      return { valid: false, error: 'Name cannot contain HTML' };
    }
  }
  
  // Check company_name field if present
  if (data.company_name !== undefined && data.company_name !== null) {
    if (typeof data.company_name !== 'string') {
      return { valid: false, error: 'Company name must be a string' };
    }
    
    const trimmedCompany = data.company_name.trim();
    if (trimmedCompany.length > 255) {
      return { valid: false, error: 'Company name must be less than 255 characters' };
    }
    
    // Basic XSS prevention - reject HTML tags
    if (/<[^>]*>/.test(trimmedCompany)) {
      return { valid: false, error: 'Company name cannot contain HTML' };
    }
  }
  
  // Check phone field if present
  if (data.phone !== undefined && data.phone !== null) {
    if (typeof data.phone !== 'string') {
      return { valid: false, error: 'Phone must be a string' };
    }
    
    if (data.phone.length > 50) {
      return { valid: false, error: 'Phone must be less than 50 characters' };
    }
  }
  
  return { valid: true };
}

// ============================================================================
// EMAIL HELPERS
// ============================================================================
const FROM_EMAIL = "Ccc@notification.cyclecourierco.com";
const ADMIN_EMAIL = "info@cyclecourierco.com";
const APPROVAL_URL = "https://booking.cyclecourierco.com/users";

async function sendRegistrationEmails(
  resend: InstanceType<typeof Resend>,
  email: string,
  userData: Record<string, unknown>
): Promise<void> {
  const name = (userData.name as string) || 'Customer';
  const companyName = (userData.company_name as string) || '';
  const phone = (userData.phone as string) || '';
  const website = (userData.website as string) || '';
  const addressLine1 = (userData.address_line_1 as string) || '';
  const addressLine2 = (userData.address_line_2 as string) || '';
  const city = (userData.city as string) || '';
  const postalCode = (userData.postal_code as string) || '';

  const fullAddress = [addressLine1, addressLine2, city, postalCode].filter(Boolean).join(", ");

  // Send user confirmation email
  await startSpan("email.send", "Send user confirmation email", async () => {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Your Business Account Application",
        text: `Hello ${name},

Thank you for creating a business account with The Cycle Courier Co.

Your account is currently pending approval, which typically takes place within 24 hours. Once approved, you'll receive another email confirming you can access your account.

If you have any questions in the meantime, please don't hesitate to contact our support team.

Thank you for choosing The Cycle Courier Co.
        `,
      });
      console.log("User confirmation email sent to:", email);
    } catch (err) {
      console.error("Failed to send user confirmation email:", err);
      captureException(err as Error, { type: "user_confirmation_email", email });
    }
  });

  // Send admin notification email
  await startSpan("email.send", "Send admin notification email", async () => {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: "New Business Registration Requires Approval",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>New Business Registration</h2>
            <p>A new business account has been created and requires approval.</p>
            
            <div style="background-color: #f7f7f7; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Business Details</h3>
              <p><strong>Business Name:</strong> ${companyName}</p>
              <p><strong>Contact Person:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Phone:</strong> ${phone}</p>
              <p><strong>Website:</strong> ${website || 'Not provided'}</p>
              <p><strong>Address:</strong> ${fullAddress}</p>
              <p><strong>Registered At:</strong> ${new Date().toISOString()}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${APPROVAL_URL}" style="background-color: #4a65d5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Review & Approve Account
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Please review this application and approve or reject it from the admin dashboard.
            </p>
          </div>
        `,
      });
      console.log("Admin notification email sent to:", ADMIN_EMAIL);
    } catch (err) {
      console.error("Failed to send admin notification email:", err);
      captureException(err as Error, { type: "admin_notification_email", email });
    }
  });
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  initSentry("create-business-user");

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    // Check rate limit FIRST
    const rateLimit = checkRateLimit(clientIP);
    if (!rateLimit.allowed) {
      console.warn('Registration: Rate limit exceeded', {
        timestamp: new Date().toISOString(),
        ip: clientIP,
        resetInMs: rateLimit.resetIn,
      });
      return new Response(
        JSON.stringify({ error: 'Too many registration attempts. Please try again later.' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000))
          } 
        }
      );
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { email, password, userData } = body;

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      console.warn('Registration: Email validation failed', {
        timestamp: new Date().toISOString(),
        error: emailValidation.error,
      });
      return new Response(
        JSON.stringify({ error: emailValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return new Response(
        JSON.stringify({ error: passwordValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate userData
    const userDataValidation = validateUserData(userData);
    if (!userDataValidation.valid) {
      return new Response(
        JSON.stringify({ error: userDataValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log registration attempt (never log password)
    console.log('Creating business user', {
      timestamp: new Date().toISOString(),
      emailDomain: email.split('@')[1],
      ip: clientIP,
      rateLimitRemaining: rateLimit.remaining,
    });

    // Create user
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: userData
    });

    if (error) {
      console.error("Error creating business user:", {
        timestamp: new Date().toISOString(),
        errorMessage: error.message,
      });
      throw error;
    }

    console.log("Business user created successfully:", {
      timestamp: new Date().toISOString(),
      userId: data.user?.id,
    });

    // Send notification emails (non-blocking - failures won't affect response)
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        await sendRegistrationEmails(resend, email.trim().toLowerCase(), userData || {});
      } else {
        console.warn("RESEND_API_KEY not set, skipping registration emails");
      }
    } catch (emailError) {
      console.error("Error sending registration emails:", emailError);
      captureException(emailError as Error, { type: "registration_emails", email });
    }

    return new Response(
      JSON.stringify({ data, success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error("Error in create-business-user function:", {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    captureException(error as Error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to create business user',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
