
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'awaiting_depot';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'in_depot_awaiting_boxing';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'boxed_awaiting_label';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'awaiting_3p_collection';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'collected_by_3p';
