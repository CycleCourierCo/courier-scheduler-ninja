import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { weekStartDate } = await req.json();
    
    if (!weekStartDate) {
      throw new Error('weekStartDate is required');
    }

    console.log(`Calculating weekly bonuses for week starting ${weekStartDate}`);

    // Calculate week end date (6 days after start)
    const startDate = new Date(weekStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    const weekEndDate = endDate.toISOString().split('T')[0];

    // Get all active drivers
    const { data: drivers, error: driversError } = await supabase
      .from('profiles')
      .select('id, name, hourly_rate')
      .eq('role', 'driver')
      .eq('is_active', true);

    if (driversError) throw driversError;

    console.log(`Found ${drivers?.length || 0} active drivers`);

    const results = [];

    for (const driver of drivers || []) {
      console.log(`Processing driver: ${driver.name} (${driver.id})`);

      // Get compliance stats for the week
      const { data: complianceData, error: complianceError } = await supabase
        .rpc('calculate_weekly_checkin_compliance', {
          p_driver_id: driver.id,
          p_week_start: weekStartDate,
          p_week_end: weekEndDate
        });

      if (complianceError) {
        console.error(`Error calculating compliance for driver ${driver.id}:`, complianceError);
        continue;
      }

      const compliance = complianceData?.[0];
      if (!compliance || compliance.total_checkins === 0) {
        console.log(`Driver ${driver.name} has no check-ins for this week`);
        continue;
      }

      const compliancePercentage = Number(compliance.compliance_percentage);
      const isEligible = compliancePercentage >= 80;

      console.log(`Driver ${driver.name}: ${compliancePercentage.toFixed(2)}% compliance (${compliance.on_time_checkins}/${compliance.total_checkins})`);

      // Check if bonus record already exists
      const { data: existingBonus } = await supabase
        .from('weekly_checkin_bonuses')
        .select('id, bonus_awarded')
        .eq('driver_id', driver.id)
        .eq('week_start_date', weekStartDate)
        .maybeSingle();

      if (existingBonus) {
        console.log(`Bonus record already exists for driver ${driver.name}`);
        results.push({
          driver_id: driver.id,
          driver_name: driver.name,
          status: 'already_processed',
          compliance_percentage: compliancePercentage
        });
        continue;
      }

      let timeslipId = null;

      // If eligible, create a timeslip custom addon for the bonus
      if (isEligible) {
        console.log(`Driver ${driver.name} is eligible for bonus - creating timeslip addon`);
        
        const hourlyRate = driver.hourly_rate || 11;
        const bonusHours = 50 / hourlyRate; // £50 divided by hourly rate

        const customAddon = {
          title: 'Weekly Punctuality Bonus',
          hours: bonusHours
        };

        // Create a timeslip for the bonus on the week start date
        const { data: timeslip, error: timeslipError } = await supabase
          .from('timeslips')
          .insert({
            driver_id: driver.id,
            date: weekStartDate,
            status: 'approved',
            driving_hours: 0,
            stop_hours: 0,
            lunch_hours: 0,
            custom_addon_hours: bonusHours,
            custom_addons: [customAddon],
            total_stops: 0,
            hourly_rate: hourlyRate,
            van_allowance: 0,
            approved_at: new Date().toISOString(),
            approved_by: '00000000-0000-0000-0000-000000000000', // System user
            admin_notes: `Automatic weekly punctuality bonus for ${compliancePercentage.toFixed(0)}% on-time check-ins`
          })
          .select()
          .single();

        if (timeslipError) {
          console.error(`Error creating timeslip for driver ${driver.id}:`, timeslipError);
        } else {
          timeslipId = timeslip.id;
          console.log(`Created timeslip ${timeslipId} for driver ${driver.name}`);
        }
      }

      // Create the bonus record
      const { error: bonusError } = await supabase
        .from('weekly_checkin_bonuses')
        .insert({
          driver_id: driver.id,
          week_start_date: weekStartDate,
          week_end_date: weekEndDate,
          total_checkins: compliance.total_checkins,
          on_time_checkins: compliance.on_time_checkins,
          bonus_awarded: isEligible,
          timeslip_id: timeslipId
        });

      if (bonusError) {
        console.error(`Error creating bonus record for driver ${driver.id}:`, bonusError);
        results.push({
          driver_id: driver.id,
          driver_name: driver.name,
          status: 'error',
          error: bonusError.message
        });
      } else {
        results.push({
          driver_id: driver.id,
          driver_name: driver.name,
          status: 'success',
          bonus_awarded: isEligible,
          compliance_percentage: compliancePercentage,
          timeslip_id: timeslipId
        });
      }
    }

    console.log('Bonus calculation complete');

    return new Response(
      JSON.stringify({
        success: true,
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error calculating weekly bonuses:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
