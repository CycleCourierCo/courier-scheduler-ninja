REVOKE EXECUTE ON FUNCTION public.next_cs_ticket_ref() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cs_pick_queue_assignee(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cs_conversations_before_insert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cs_conversations_before_update() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cs_messages_after_insert() FROM anon, authenticated;