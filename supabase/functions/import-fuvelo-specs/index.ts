import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { SPEC_DATA } from './specData.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OWNER_EMAIL = 'shopify@cyclecourierco.com';
const HOLDING_BAY = 'UNALLOCATED';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // One-shot importer: refuses to run once the Fuvelo catalogue exists.
  // Deleted immediately after the import completes.

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { data: owner, error: ownerError } = await admin
      .from('profiles')
      .select('id')
      .eq('email', OWNER_EMAIL)
      .maybeSingle();
    if (ownerError) throw ownerError;
    if (!owner) throw new Error('Owner account not found');
    const ownerId = owner.id as string;

    // 1. Templates (skip any that already exist by name for this owner)
    const { data: existing } = await admin
      .from('bike_build_templates')
      .select('id, name')
      .eq('user_id', ownerId);
    const existingNames = new Set((existing || []).map((t: any) => t.name));

    if (SPEC_DATA.templates.every((t) => existingNames.has(t.name))) {
      return new Response(JSON.stringify({ error: 'Already imported' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const toInsert = SPEC_DATA.templates.filter((t) => !existingNames.has(t.name));
    let insertedTemplates: any[] = [];
    if (toInsert.length > 0) {
      const { data, error } = await admin
        .from('bike_build_templates')
        .insert(
          toInsert.map((t) => ({
            user_id: ownerId,
            created_by: ownerId,
            name: t.name,
            bike_brand: t.brand,
            bike_model: t.model,
            bike_type: t.type,
            spec_notes: `Fuvelo stock build - imported from the ${t.name} spec sheet`,
          }))
        )
        .select('id, name');
      if (error) throw error;
      insertedTemplates = data || [];
    }

    // 2. Template items with the exact spec text on each part
    const idByName = new Map(insertedTemplates.map((t: any) => [t.name, t.id]));
    const itemRows = SPEC_DATA.items
      .filter((i) => idByName.has(i.t))
      .map((i) => ({
        template_id: idByName.get(i.t),
        category: i.c,
        quantity: i.q,
        notes: i.n,
      }));
    if (itemRows.length > 0) {
      const { error } = await admin.from('bike_build_template_items').insert(itemRows);
      if (error) throw error;
    }

    // 3. One zero-quantity catalogue row per distinct (category, spec)
    const { data: currentStock } = await admin
      .from('warehouse_stock')
      .select('component_category, spec')
      .eq('user_id', ownerId)
      .eq('item_kind', 'component');
    const stockKeys = new Set(
      (currentStock || []).map((s: any) => `${s.component_category}||${s.spec}`)
    );

    const partMap = new Map<string, { category: string; spec: string }>();
    for (const i of SPEC_DATA.items) {
      const key = `${i.c}||${i.n}`;
      if (stockKeys.has(key) || partMap.has(key)) continue;
      partMap.set(key, { category: i.c, spec: i.n });
    }

    const stockRows = [...partMap.values()].map((p) => ({
      user_id: ownerId,
      deposited_by: ownerId,
      item_kind: 'component',
      component_category: p.category,
      quantity: 0,
      spec: p.spec,
      bike_brand: p.spec.split(',')[0].split(' ')[0],
      bay: HOLDING_BAY,
      position: 0,
      status: 'stored',
      item_notes: 'Fuvelo catalogue part - use Receive to book stock into a bay',
    }));
    if (stockRows.length > 0) {
      const { error } = await admin.from('warehouse_stock').insert(stockRows);
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        templates_created: insertedTemplates.length,
        template_items_created: itemRows.length,
        parts_created: stockRows.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('import-fuvelo-specs failed', (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
