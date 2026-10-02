CREATE TABLE public.order_invoice_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  quickbooks_invoice_id text NOT NULL,
  quickbooks_invoice_number text,
  quickbooks_invoice_url text NOT NULL,
  invoice_date date,
  link_source text NOT NULL CHECK (link_source IN ('invoice_creation', 'quickbooks_sync')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, quickbooks_invoice_id)
);

GRANT SELECT ON public.order_invoice_links TO authenticated;
GRANT ALL ON public.order_invoice_links TO service_role;
ALTER TABLE public.order_invoice_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view order invoice links"
ON public.order_invoice_links
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);

CREATE INDEX order_invoice_links_order_id_idx ON public.order_invoice_links(order_id);
CREATE INDEX order_invoice_links_quickbooks_invoice_id_idx ON public.order_invoice_links(quickbooks_invoice_id);

CREATE TABLE public.order_invoice_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_by uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  invoices_scanned integer NOT NULL DEFAULT 0,
  linked_count integer NOT NULL DEFAULT 0,
  already_linked_count integer NOT NULL DEFAULT 0,
  unmatched_count integer NOT NULL DEFAULT 0,
  ambiguous_count integer NOT NULL DEFAULT 0,
  error_message text
);

GRANT SELECT ON public.order_invoice_sync_runs TO authenticated;
GRANT ALL ON public.order_invoice_sync_runs TO service_role;
ALTER TABLE public.order_invoice_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invoice sync runs"
ON public.order_invoice_sync_runs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
  )
);