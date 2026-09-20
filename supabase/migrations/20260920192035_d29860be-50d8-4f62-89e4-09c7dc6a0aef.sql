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

  IF NEW.direction IN ('in','inbound') THEN
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

  ELSIF NEW.direction IN ('out','outbound') THEN
    UPDATE public.cs_conversations
       SET next_response_due_at = NULL
     WHERE id = v_conv.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cs_messages_after_insert() FROM anon, authenticated;