DROP POLICY IF EXISTS fuel_card_select ON public.fuel_card_settings;
CREATE POLICY fuel_card_select ON public.fuel_card_settings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role::text NOT IN ('b2b_customer','b2c_customer')));
DROP POLICY IF EXISTS fuel_cards_select_policy ON public.fuel_cards;
CREATE POLICY fuel_cards_select_policy ON public.fuel_cards FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role::text NOT IN ('b2b_customer','b2c_customer')));