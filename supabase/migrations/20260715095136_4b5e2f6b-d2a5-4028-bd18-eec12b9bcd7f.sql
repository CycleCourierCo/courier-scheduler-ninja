CREATE OR REPLACE FUNCTION public.update_user_profile_for_management(
  p_user_id uuid,
  p_updates jsonb
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' THEN
    RAISE EXCEPTION 'Updates object is required';
  END IF;

  IF NOT public.is_admin_or_sales() THEN
    RAISE EXCEPTION 'Admin or Sales access required';
  END IF;

  UPDATE public.profiles
  SET
    name = CASE WHEN p_updates ? 'name' THEN p_updates->>'name' ELSE name END,
    email = CASE WHEN p_updates ? 'email' THEN p_updates->>'email' ELSE email END,
    phone = CASE WHEN p_updates ? 'phone' THEN p_updates->>'phone' ELSE phone END,
    company_name = CASE WHEN p_updates ? 'company_name' THEN p_updates->>'company_name' ELSE company_name END,
    website = CASE WHEN p_updates ? 'website' THEN p_updates->>'website' ELSE website END,
    accounts_email = CASE WHEN p_updates ? 'accounts_email' THEN p_updates->>'accounts_email' ELSE accounts_email END,
    address_line_1 = CASE WHEN p_updates ? 'address_line_1' THEN p_updates->>'address_line_1' ELSE address_line_1 END,
    address_line_2 = CASE WHEN p_updates ? 'address_line_2' THEN p_updates->>'address_line_2' ELSE address_line_2 END,
    city = CASE WHEN p_updates ? 'city' THEN p_updates->>'city' ELSE city END,
    postal_code = CASE WHEN p_updates ? 'postal_code' THEN p_updates->>'postal_code' ELSE postal_code END,
    account_status = CASE WHEN p_updates ? 'account_status' THEN (p_updates->>'account_status')::account_status_type ELSE account_status END,
    special_rate_code = CASE WHEN p_updates ? 'special_rate_code' THEN p_updates->>'special_rate_code' ELSE special_rate_code END,
    special_rate_price = CASE WHEN p_updates ? 'special_rate_price' THEN (p_updates->>'special_rate_price')::numeric ELSE special_rate_price END,
    opening_hours = CASE WHEN p_updates ? 'opening_hours' THEN NULLIF(p_updates->'opening_hours', 'null'::jsonb) ELSE opening_hours END,
    is_test_account = CASE WHEN p_updates ? 'is_test_account' THEN (p_updates->>'is_test_account')::boolean ELSE is_test_account END,
    hourly_rate = CASE WHEN p_updates ? 'hourly_rate' THEN (p_updates->>'hourly_rate')::numeric ELSE hourly_rate END,
    uses_own_van = CASE WHEN p_updates ? 'uses_own_van' THEN (p_updates->>'uses_own_van')::boolean ELSE uses_own_van END,
    van_allowance = CASE WHEN p_updates ? 'van_allowance' THEN (p_updates->>'van_allowance')::numeric ELSE van_allowance END,
    is_active = CASE WHEN p_updates ? 'is_active' THEN (p_updates->>'is_active')::boolean ELSE is_active END,
    available_hours = CASE WHEN p_updates ? 'available_hours' THEN (p_updates->>'available_hours')::integer ELSE available_hours END,
    shipday_driver_id = CASE WHEN p_updates ? 'shipday_driver_id' THEN p_updates->>'shipday_driver_id' ELSE shipday_driver_id END,
    shipday_driver_name = CASE WHEN p_updates ? 'shipday_driver_name' THEN p_updates->>'shipday_driver_name' ELSE shipday_driver_name END,
    default_vehicle_id = CASE WHEN p_updates ? 'default_vehicle_id' THEN (p_updates->>'default_vehicle_id')::uuid ELSE default_vehicle_id END,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_profile_for_management(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile_for_management(uuid, jsonb) TO service_role;