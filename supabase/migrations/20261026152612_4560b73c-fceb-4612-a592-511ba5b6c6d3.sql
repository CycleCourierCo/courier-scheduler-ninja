ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pay_type text NOT NULL DEFAULT 'hourly', ADD COLUMN IF NOT EXISTS per_mile_rate numeric(8,2);
ALTER TABLE public.timeslips ADD COLUMN IF NOT EXISTS pay_type text NOT NULL DEFAULT 'hourly', ADD COLUMN IF NOT EXISTS per_mile_rate numeric(8,2);

CREATE OR REPLACE FUNCTION public.validate_pay_type() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.pay_type NOT IN ('hourly','per_mile') THEN RAISE EXCEPTION 'pay_type must be hourly or per_mile'; END IF;
  IF NEW.per_mile_rate IS NOT NULL AND NEW.per_mile_rate < 0 THEN RAISE EXCEPTION 'per_mile_rate cannot be negative'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_pay_type_profiles ON public.profiles;
CREATE TRIGGER validate_pay_type_profiles BEFORE INSERT OR UPDATE OF pay_type, per_mile_rate ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_pay_type();
DROP TRIGGER IF EXISTS validate_pay_type_timeslips ON public.timeslips;
CREATE TRIGGER validate_pay_type_timeslips BEFORE INSERT OR UPDATE OF pay_type, per_mile_rate ON public.timeslips FOR EACH ROW EXECUTE FUNCTION public.validate_pay_type();

-- New timeslips inherit the driver's pay type when not given explicitly
CREATE OR REPLACE FUNCTION public.timeslip_inherit_pay_type() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  IF NEW.driver_id IS NOT NULL AND NEW.pay_type = 'hourly' AND NEW.per_mile_rate IS NULL THEN
    SELECT pay_type, per_mile_rate INTO p FROM public.profiles WHERE id = NEW.driver_id;
    IF p.pay_type = 'per_mile' THEN NEW.pay_type := 'per_mile'; NEW.per_mile_rate := p.per_mile_rate; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS timeslip_inherit_pay_type ON public.timeslips;
CREATE TRIGGER timeslip_inherit_pay_type BEFORE INSERT ON public.timeslips FOR EACH ROW EXECUTE FUNCTION public.timeslip_inherit_pay_type();

ALTER TABLE public.timeslips DROP COLUMN total_pay;
ALTER TABLE public.timeslips ADD COLUMN total_pay numeric(10,2) GENERATED ALWAYS AS (
  CASE WHEN pay_type = 'per_mile' THEN COALESCE(mileage,0) * COALESCE(per_mile_rate,0) + COALESCE(van_allowance,0)
  ELSE (driving_hours + stop_hours + lunch_hours + custom_addon_hours) * hourly_rate + van_allowance END) STORED;

CREATE OR REPLACE FUNCTION public.update_user_profile_for_management(p_user_id uuid, p_updates jsonb)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_profile public.profiles;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'User ID is required'; END IF;
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' THEN RAISE EXCEPTION 'Updates object is required'; END IF;
  IF NOT public.is_admin_or_sales() THEN RAISE EXCEPTION 'Admin or Sales access required'; END IF;
  UPDATE public.profiles SET
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
    large_bike_rate_code = CASE WHEN p_updates ? 'large_bike_rate_code' THEN NULLIF(p_updates->>'large_bike_rate_code', '') ELSE large_bike_rate_code END,
    special_rate_price = CASE WHEN p_updates ? 'special_rate_price' THEN (p_updates->>'special_rate_price')::numeric ELSE special_rate_price END,
    opening_hours = CASE WHEN p_updates ? 'opening_hours' THEN NULLIF(p_updates->'opening_hours', 'null'::jsonb) ELSE opening_hours END,
    is_test_account = CASE WHEN p_updates ? 'is_test_account' THEN (p_updates->>'is_test_account')::boolean ELSE is_test_account END,
    show_sender_on_label = CASE WHEN p_updates ? 'show_sender_on_label' THEN COALESCE((p_updates->>'show_sender_on_label')::boolean, false) ELSE show_sender_on_label END,
    hourly_rate = CASE WHEN p_updates ? 'hourly_rate' THEN (p_updates->>'hourly_rate')::numeric ELSE hourly_rate END,
    pay_type = CASE WHEN p_updates ? 'pay_type' THEN COALESCE(NULLIF(p_updates->>'pay_type',''),'hourly') ELSE pay_type END,
    per_mile_rate = CASE WHEN p_updates ? 'per_mile_rate' THEN NULLIF(p_updates->>'per_mile_rate', '')::numeric ELSE per_mile_rate END,
    workshop_hourly_rate = CASE WHEN p_updates ? 'workshop_hourly_rate' THEN NULLIF(p_updates->>'workshop_hourly_rate', '')::numeric ELSE workshop_hourly_rate END,
    uses_own_van = CASE WHEN p_updates ? 'uses_own_van' THEN (p_updates->>'uses_own_van')::boolean ELSE uses_own_van END,
    van_allowance = CASE WHEN p_updates ? 'van_allowance' THEN (p_updates->>'van_allowance')::numeric ELSE van_allowance END,
    is_active = CASE WHEN p_updates ? 'is_active' THEN (p_updates->>'is_active')::boolean ELSE is_active END,
    available_hours = CASE WHEN p_updates ? 'available_hours' THEN (p_updates->>'available_hours')::integer ELSE available_hours END,
    shipday_driver_id = CASE WHEN p_updates ? 'shipday_driver_id' THEN p_updates->>'shipday_driver_id' ELSE shipday_driver_id END,
    shipday_driver_name = CASE WHEN p_updates ? 'shipday_driver_name' THEN p_updates->>'shipday_driver_name' ELSE shipday_driver_name END,
    default_vehicle_id = CASE WHEN p_updates ? 'default_vehicle_id' THEN (p_updates->>'default_vehicle_id')::uuid ELSE default_vehicle_id END,
    licence_front_path = CASE WHEN p_updates ? 'licence_front_path' THEN NULLIF(p_updates->>'licence_front_path', '') ELSE licence_front_path END,
    licence_back_path = CASE WHEN p_updates ? 'licence_back_path' THEN NULLIF(p_updates->>'licence_back_path', '') ELSE licence_back_path END,
    licence_check_code_path = CASE WHEN p_updates ? 'licence_check_code_path' THEN NULLIF(p_updates->>'licence_check_code_path', '') ELSE licence_check_code_path END,
    licence_number = CASE WHEN p_updates ? 'licence_number' THEN NULLIF(p_updates->>'licence_number', '') ELSE licence_number END,
    licence_expiry = CASE WHEN p_updates ? 'licence_expiry' THEN NULLIF(p_updates->>'licence_expiry', '')::date ELSE licence_expiry END,
    licence_updated_at = CASE WHEN p_updates ? 'licence_updated_at' THEN NULLIF(p_updates->>'licence_updated_at', '')::timestamptz ELSE licence_updated_at END,
    updated_at = now()
  WHERE id = p_user_id RETURNING * INTO v_profile;
  IF NOT FOUND THEN RAISE EXCEPTION 'User profile not found'; END IF;
  RETURN v_profile;
END; $function$;