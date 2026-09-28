CREATE TABLE public.warehouse_storage_charges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), stock_id uuid NOT NULL, customer_id uuid NOT NULL, period_number integer NOT NULL, period_start date NOT NULL, period_end date NOT NULL, amount_gbp numeric(10,2) NOT NULL DEFAULT 40.00, status text NOT NULL DEFAULT 'processing', quickbooks_invoice_id text, quickbooks_invoice_number text, failure_reason text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT warehouse_storage_charges_unique_period UNIQUE (stock_id, period_number),
 CONSTRAINT warehouse_storage_charges_positive_period CHECK (period_number >= 0),
 CONSTRAINT warehouse_storage_charges_valid_status CHECK (status IN ('processing','invoiced','review'))
);
GRANT ALL ON public.warehouse_storage_charges TO service_role;
ALTER TABLE public.warehouse_storage_charges ENABLE ROW LEVEL SECURITY;
CREATE INDEX warehouse_storage_charges_customer_idx ON public.warehouse_storage_charges(customer_id,period_start);
CREATE OR REPLACE FUNCTION public.touch_warehouse_storage_charges() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at:=now(); RETURN NEW; END $$;
CREATE TRIGGER warehouse_storage_charges_touch BEFORE UPDATE ON public.warehouse_storage_charges FOR EACH ROW EXECUTE FUNCTION public.touch_warehouse_storage_charges();
CREATE OR REPLACE FUNCTION public.stamp_warehouse_stock_dispatch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.item_kind='bike' AND NEW.status IN ('dispatched','returned') AND OLD.status NOT IN ('dispatched','returned') AND NEW.dispatched_at IS NULL THEN NEW.dispatched_at:=now(); END IF; RETURN NEW; END $$;
CREATE TRIGGER warehouse_stock_dispatch_stamp BEFORE UPDATE ON public.warehouse_stock FOR EACH ROW EXECUTE FUNCTION public.stamp_warehouse_stock_dispatch();