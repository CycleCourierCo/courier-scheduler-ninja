ALTER TABLE public.cs_canned_responses
  ADD COLUMN IF NOT EXISTS auto_send_mode text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS blocked_from_auto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_disabled_reason text,
  ADD COLUMN IF NOT EXISTS auto_disabled_notified_at timestamptz;

UPDATE public.cs_canned_responses SET blocked_from_auto = true
WHERE title ~* '(damage|claim|complaint|cancel|invoice|payment|refund|missing)'
   OR category ~* '(damage|claim|complaint|invoice|payment)';

CREATE TABLE public.cs_canned_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.cs_canned_responses(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.cs_conversations(id) ON DELETE CASCADE,
  inbound_message_id uuid REFERENCES public.cs_messages(id) ON DELETE SET NULL,
  sent_message_id uuid REFERENCES public.cs_messages(id) ON DELETE SET NULL,
  match_score numeric NOT NULL DEFAULT 0,
  runner_up_score numeric NOT NULL DEFAULT 0,
  outcome text NOT NULL,
  similarity numeric,
  staff_id uuid,
  auto_sent boolean NOT NULL DEFAULT false,
  flagged_wrong boolean NOT NULL DEFAULT false,
  flagged_by uuid,
  flagged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cs_canned_usage_response_idx ON public.cs_canned_usage(response_id, created_at DESC);
CREATE INDEX cs_canned_usage_inbound_idx ON public.cs_canned_usage(inbound_message_id);
CREATE INDEX cs_canned_usage_sent_idx ON public.cs_canned_usage(sent_message_id);

GRANT SELECT, INSERT ON public.cs_canned_usage TO authenticated;
GRANT ALL ON public.cs_canned_usage TO service_role;
ALTER TABLE public.cs_canned_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs staff read canned usage" ON public.cs_canned_usage FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE has_role(u.uid,'admin'::user_role) OR has_role(u.uid,'cs_agent'::user_role)));
CREATE POLICY "cs staff record own canned outcomes" ON public.cs_canned_usage FOR INSERT TO authenticated
WITH CHECK (
  staff_id = (SELECT auth.uid())
  AND auto_sent = false AND flagged_wrong = false
  AND outcome IN ('as_is','edited','rewritten','replaced')
  AND EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE has_role(u.uid,'admin'::user_role) OR has_role(u.uid,'cs_agent'::user_role))
);

-- Rolling confidence over the last 50 staff decisions.
CREATE OR REPLACE FUNCTION public.cs_canned_confidence_of(p_id uuid)
RETURNS TABLE(uses integer, window_uses integer, confidence numeric)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH recent AS (
    SELECT outcome FROM cs_canned_usage
    WHERE response_id = p_id AND outcome IN ('as_is','edited','rewritten','replaced')
    ORDER BY created_at DESC LIMIT 50
  )
  SELECT
    (SELECT count(*)::int FROM cs_canned_usage WHERE response_id = p_id AND outcome IN ('as_is','edited','rewritten','replaced')),
    (SELECT count(*)::int FROM recent),
    (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE
       sum(CASE outcome WHEN 'as_is' THEN 1 WHEN 'edited' THEN 0.5 ELSE 0 END)::numeric / count(*) END FROM recent);
$$;
REVOKE EXECUTE ON FUNCTION public.cs_canned_confidence_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cs_canned_confidence_of(uuid) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.cs_canned_stats WITH (security_invoker = true) AS
SELECT r.id AS response_id,
  c.uses, c.window_uses, c.confidence,
  (SELECT count(*)::int FROM cs_canned_usage x WHERE x.response_id = r.id AND x.outcome = 'as_is') AS as_is,
  (SELECT count(*)::int FROM cs_canned_usage x WHERE x.response_id = r.id AND x.outcome = 'edited') AS edited,
  (SELECT count(*)::int FROM cs_canned_usage x WHERE x.response_id = r.id AND x.outcome = 'rewritten') AS rewritten,
  (SELECT count(*)::int FROM cs_canned_usage x WHERE x.response_id = r.id AND x.outcome = 'replaced') AS replaced,
  (SELECT count(*)::int FROM cs_canned_usage x WHERE x.response_id = r.id AND x.outcome = 'auto_sent') AS auto_sent,
  (SELECT count(*)::int FROM cs_canned_usage x WHERE x.response_id = r.id AND x.flagged_wrong) AS flagged_wrong,
  (SELECT count(*)::int FROM cs_canned_usage x WHERE x.response_id = r.id AND x.outcome = 'trial') AS trial_total,
  (SELECT count(*)::int FROM cs_canned_usage t WHERE t.response_id = r.id AND t.outcome = 'trial'
     AND EXISTS (SELECT 1 FROM cs_canned_usage s WHERE s.inbound_message_id = t.inbound_message_id
       AND s.response_id = r.id AND s.outcome IN ('as_is','edited'))) AS trial_agreed,
  (SELECT count(*)::int FROM cs_canned_usage t WHERE t.response_id = r.id AND t.outcome = 'trial'
     AND EXISTS (SELECT 1 FROM cs_canned_usage s WHERE s.inbound_message_id = t.inbound_message_id
       AND s.outcome IN ('as_is','edited','rewritten','replaced'))) AS trial_reviewed
FROM cs_canned_responses r
CROSS JOIN LATERAL cs_canned_confidence_of(r.id) c;
GRANT SELECT ON public.cs_canned_stats TO authenticated, service_role;

-- Live auto-send must be earned; any change to auto-send settings is admin-only (RLS already limits updates to admins).
CREATE OR REPLACE FUNCTION public.cs_canned_guard_auto_send()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF NEW.auto_send_mode NOT IN ('off','trial','live') THEN RAISE EXCEPTION 'invalid auto_send_mode'; END IF;
  IF NEW.auto_send_mode <> 'off' AND NEW.blocked_from_auto THEN
    RAISE EXCEPTION 'This response is marked never to auto-send';
  END IF;
  IF NEW.auto_send_mode = 'live' AND OLD.auto_send_mode IS DISTINCT FROM 'live' THEN
    SELECT * INTO c FROM cs_canned_confidence_of(NEW.id);
    IF coalesce(c.uses,0) < 30 OR coalesce(c.confidence,0) < 0.9 THEN
      RAISE EXCEPTION 'Auto-send needs at least 30 uses and 90%% confidence';
    END IF;
  END IF;
  IF NEW.auto_send_mode <> 'off' AND OLD.auto_send_mode = 'off' THEN
    NEW.auto_disabled_at := NULL; NEW.auto_disabled_reason := NULL; NEW.auto_disabled_notified_at := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cs_canned_guard_auto_send BEFORE UPDATE ON public.cs_canned_responses
FOR EACH ROW EXECUTE FUNCTION public.cs_canned_guard_auto_send();

-- Switch auto-send off when confidence drops below 85% or a staff member flags a wrong auto-reply.
CREATE OR REPLACE FUNCTION public.cs_canned_usage_autodisable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; reason text;
BEGIN
  IF NEW.flagged_wrong AND (TG_OP = 'INSERT' OR NOT OLD.flagged_wrong) THEN
    reason := 'Staff flagged an auto-reply as wrong';
  ELSIF NEW.outcome IN ('as_is','edited','rewritten','replaced') AND TG_OP = 'INSERT' THEN
    SELECT * INTO c FROM cs_canned_confidence_of(NEW.response_id);
    IF coalesce(c.uses,0) >= 30 AND coalesce(c.confidence,1) < 0.85 THEN
      reason := format('Confidence fell to %s%%', round(c.confidence*100));
    END IF;
  END IF;
  IF reason IS NOT NULL THEN
    UPDATE cs_canned_responses SET auto_send_mode = 'off', auto_disabled_at = now(), auto_disabled_reason = reason
    WHERE id = NEW.response_id AND auto_send_mode <> 'off';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.cs_canned_usage_autodisable() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cs_canned_usage_autodisable AFTER INSERT OR UPDATE OF flagged_wrong ON public.cs_canned_usage
FOR EACH ROW EXECUTE FUNCTION public.cs_canned_usage_autodisable();