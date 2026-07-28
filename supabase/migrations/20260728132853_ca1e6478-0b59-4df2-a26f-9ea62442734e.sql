DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = 'order_status' AND e.enumlabel = 'delivered_to_ferry') THEN
    ALTER TYPE public.order_status ADD VALUE 'delivered_to_ferry';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'foam_status') THEN
    CREATE TYPE public.foam_status AS ENUM (
      'pending_collection',
      'pending_foaming',
      'foamed_ready',
      'delivered_to_ferry',
      'delivered_ni'
    );
  END IF;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS destination_region text,
  ADD COLUMN IF NOT EXISTS is_northern_ireland boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS foam_status public.foam_status,
  ADD COLUMN IF NOT EXISTS foam_pending_collection_at timestamptz,
  ADD COLUMN IF NOT EXISTS foam_pending_foaming_at timestamptz,
  ADD COLUMN IF NOT EXISTS foam_foamed_at timestamptz,
  ADD COLUMN IF NOT EXISTS foam_delivered_to_ferry_at timestamptz,
  ADD COLUMN IF NOT EXISTS foam_delivered_ni_at timestamptz,
  ADD COLUMN IF NOT EXISTS foam_delivery_photos jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_orders_is_northern_ireland ON public.orders (is_northern_ireland) WHERE is_northern_ireland = true;