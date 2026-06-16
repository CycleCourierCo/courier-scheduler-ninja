CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.user_role;
BEGIN
  v_role := CASE
    WHEN new.raw_user_meta_data->>'is_business' = 'true' THEN 'b2b_customer'::public.user_role
    ELSE 'b2c_customer'::public.user_role
  END;

  INSERT INTO public.profiles (
    id, name, email, role, company_name, website, phone, is_business,
    account_status, address_line_1, address_line_2, city, postal_code
  )
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.email,
    v_role,
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'website',
    new.raw_user_meta_data->>'phone',
    (new.raw_user_meta_data->>'is_business')::boolean,
    CASE
      WHEN new.raw_user_meta_data->>'is_business' = 'true' THEN 'pending'::account_status_type
      ELSE 'approved'::account_status_type
    END,
    new.raw_user_meta_data->>'address_line_1',
    new.raw_user_meta_data->>'address_line_2',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'postal_code'
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN new;
END;
$function$;