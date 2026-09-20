-- 1. Priority enum
DO $$ BEGIN
  CREATE TYPE public.cs_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Queues
CREATE TABLE public.cs_queues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  rr_cursor integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_queues TO authenticated;
GRANT ALL ON public.cs_queues TO service_role;
ALTER TABLE public.cs_queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs admins/agents manage queues" ON public.cs_queues FOR ALL
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u
  WHERE has_role(u.uid,'admin'::user_role) OR has_role(u.uid,'cs_agent'::user_role)))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u
  WHERE has_role(u.uid,'admin'::user_role) OR has_role(u.uid,'cs_agent'::user_role)));

CREATE UNIQUE INDEX cs_queues_single_default ON public.cs_queues (is_default) WHERE is_default;

-- 3. Queue members
CREATE TABLE public.cs_queue_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id uuid NOT NULL REFERENCES public.cs_queues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (queue_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_queue_members TO authenticated;
GRANT ALL ON public.cs_queue_members TO service_role;
ALTER TABLE public.cs_queue_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs admins/agents manage queue members" ON public.cs_queue_members FOR ALL
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u
  WHERE has_role(u.uid,'admin'::user_role) OR has_role(u.uid,'cs_agent'::user_role)))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u
  WHERE has_role(u.uid,'admin'::user_role) OR has_role(u.uid,'cs_agent'::user_role)));

-- 4. SLA targets
CREATE TABLE public.cs_queue_slas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id uuid NOT NULL REFERENCES public.cs_queues(id) ON DELETE CASCADE,
  priority public.cs_priority NOT NULL,
  target_minutes integer NOT NULL DEFAULT 240,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (queue_id, priority)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_queue_slas TO authenticated;
GRANT ALL ON public.cs_queue_slas TO service_role;
ALTER TABLE public.cs_queue_slas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs admins/agents manage queue slas" ON public.cs_queue_slas FOR ALL
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u
  WHERE has_role(u.uid,'admin'::user_role) OR has_role(u.uid,'cs_agent'::user_role)))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u
  WHERE has_role(u.uid,'admin'::user_role) OR has_role(u.uid,'cs_agent'::user_role)));

-- 5. Ticket reference counter
CREATE TABLE public.cs_ticket_ref_counters (
  scope text NOT NULL PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 1000
);
GRANT SELECT ON public.cs_ticket_ref_counters TO authenticated;
GRANT ALL ON public.cs_ticket_ref_counters TO service_role;
ALTER TABLE public.cs_ticket_ref_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs admins/agents read ticket counter" ON public.cs_ticket_ref_counters FOR SELECT
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u
  WHERE has_role(u.uid,'admin'::user_role) OR has_role(u.uid,'cs_agent'::user_role)));
INSERT INTO public.cs_ticket_ref_counters (scope, last_value) VALUES ('ticket', 1000);

-- 6. Conversation columns
ALTER TABLE public.cs_conversations
  ADD COLUMN IF NOT EXISTS ticket_ref text,
  ADD COLUMN IF NOT EXISTS queue_id uuid REFERENCES public.cs_queues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority public.cs_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS first_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_manually boolean NOT NULL DEFAULT false;

-- 7. Default queues
INSERT INTO public.cs_queues (name, slug, description, is_default, sort_order) VALUES
  ('General', 'general', 'Anything not yet sorted into a queue', true, 0),
  ('Deliveries', 'deliveries', 'Collection and delivery questions', false, 1),
  ('Claims', 'claims', 'Damage and loss claims', false, 2),
  ('Accounts', 'accounts', 'Invoices, pricing and account questions', false, 3),
  ('Workshop', 'workshop', 'Inspections, repairs and builds', false, 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.cs_queue_slas (queue_id, priority, target_minutes)
SELECT q.id, p.priority, p.mins
FROM public.cs_queues q
CROSS JOIN (VALUES
  ('low'::public.cs_priority, 1440),
  ('normal'::public.cs_priority, 480),
  ('high'::public.cs_priority, 120),
  ('urgent'::public.cs_priority, 30)
) AS p(priority, mins)
ON CONFLICT (queue_id, priority) DO NOTHING;

-- 8. Reference minting
CREATE OR REPLACE FUNCTION public.next_cs_ticket_ref()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v integer;
BEGIN
  UPDATE public.cs_ticket_ref_counters
     SET last_value = last_value + 1
   WHERE scope = 'ticket'
  RETURNING last_value INTO v;
  RETURN 'TCK-' || v::text;
END;
$$;

-- 9. Round robin assignment
CREATE OR REPLACE FUNCTION public.cs_pick_queue_assignee(p_queue_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_cursor integer;
  v_user uuid;
BEGIN
  IF p_queue_id IS NULL THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_count
    FROM public.cs_queue_members
   WHERE queue_id = p_queue_id AND is_active;

  IF v_count = 0 THEN RETURN NULL; END IF;

  UPDATE public.cs_queues
     SET rr_cursor = rr_cursor + 1
   WHERE id = p_queue_id
  RETURNING rr_cursor INTO v_cursor;

  SELECT user_id INTO v_user
    FROM public.cs_queue_members
   WHERE queue_id = p_queue_id AND is_active
   ORDER BY sort_order, created_at, id
   OFFSET (v_cursor % v_count)
   LIMIT 1;

  RETURN v_user;
END;
$$;

-- 10. Conversation insert defaults
CREATE OR REPLACE FUNCTION public.cs_conversations_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_ref IS NULL THEN
    NEW.ticket_ref := public.next_cs_ticket_ref();
  END IF;

  IF NEW.queue_id IS NULL THEN
    SELECT id INTO NEW.queue_id FROM public.cs_queues
     WHERE is_default AND is_active LIMIT 1;
  END IF;

  IF NEW.assignee_id IS NULL THEN
    NEW.assignee_id := public.cs_pick_queue_assignee(NEW.queue_id);
  ELSE
    NEW.assigned_manually := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cs_conversations_before_insert ON public.cs_conversations;
CREATE TRIGGER cs_conversations_before_insert
BEFORE INSERT ON public.cs_conversations
FOR EACH ROW EXECUTE FUNCTION public.cs_conversations_before_insert();

-- 11. Queue change re-assignment
CREATE OR REPLACE FUNCTION public.cs_conversations_before_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    NEW.assigned_manually := NEW.assignee_id IS NOT NULL;
  END IF;

  IF NEW.queue_id IS DISTINCT FROM OLD.queue_id
     AND NOT NEW.assigned_manually
     AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN
    NEW.assignee_id := public.cs_pick_queue_assignee(NEW.queue_id);
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cs_conversations_before_update ON public.cs_conversations;
CREATE TRIGGER cs_conversations_before_update
BEFORE UPDATE ON public.cs_conversations
FOR EACH ROW EXECUTE FUNCTION public.cs_conversations_before_update();

-- 12. Reply deadlines driven by messages
CREATE OR REPLACE FUNCTION public.cs_messages_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.cs_conversations;
  v_minutes integer;
  v_due timestamptz;
  v_assignee uuid;
BEGIN
  SELECT * INTO v_conv FROM public.cs_conversations WHERE id = NEW.conversation_id;
  IF v_conv.id IS NULL THEN RETURN NEW; END IF;

  IF NEW.direction = 'inbound' THEN
    SELECT target_minutes INTO v_minutes
      FROM public.cs_queue_slas
     WHERE queue_id = v_conv.queue_id AND priority = v_conv.priority;
    v_minutes := COALESCE(v_minutes, 480);
    v_due := NEW.created_at + make_interval(mins => v_minutes);

    v_assignee := v_conv.assignee_id;
    IF v_assignee IS NULL AND NOT v_conv.assigned_manually THEN
      v_assignee := public.cs_pick_queue_assignee(v_conv.queue_id);
    END IF;

    UPDATE public.cs_conversations
       SET next_response_due_at = v_due,
           first_response_due_at = COALESCE(first_response_due_at, v_due),
           assignee_id = v_assignee
     WHERE id = v_conv.id;

  ELSIF NEW.direction = 'outbound' THEN
    UPDATE public.cs_conversations
       SET next_response_due_at = NULL
     WHERE id = v_conv.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cs_messages_after_insert ON public.cs_messages;
CREATE TRIGGER cs_messages_after_insert
AFTER INSERT ON public.cs_messages
FOR EACH ROW EXECUTE FUNCTION public.cs_messages_after_insert();

-- 13. Backfill existing conversations
UPDATE public.cs_conversations c
   SET queue_id = (SELECT id FROM public.cs_queues WHERE is_default LIMIT 1)
 WHERE c.queue_id IS NULL;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.cs_conversations WHERE ticket_ref IS NULL ORDER BY created_at LOOP
    UPDATE public.cs_conversations SET ticket_ref = public.next_cs_ticket_ref() WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.cs_conversations
  ADD CONSTRAINT cs_conversations_ticket_ref_key UNIQUE (ticket_ref);

CREATE INDEX IF NOT EXISTS cs_conversations_queue_idx ON public.cs_conversations (queue_id, status);
CREATE INDEX IF NOT EXISTS cs_conversations_due_idx ON public.cs_conversations (next_response_due_at);