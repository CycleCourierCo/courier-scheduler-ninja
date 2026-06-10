import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchConversations, fetchMessages, fetchConversation, type FetchConversationsParams } from "@/services/customerServiceInboxService";

export const useConversations = (params: FetchConversationsParams) => {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['cs-conversations', params],
    queryFn: () => fetchConversations(params),
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel('cs-conversations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cs_conversations' }, () => {
        qc.invalidateQueries({ queryKey: ['cs-conversations'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return query;
};

export const useConversation = (id: string | undefined) => {
  return useQuery({
    queryKey: ['cs-conversation', id],
    queryFn: () => fetchConversation(id!),
    enabled: !!id,
  });
};

export const useMessages = (conversationId: string | undefined) => {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['cs-messages', conversationId],
    queryFn: () => fetchMessages(conversationId!),
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`cs-messages-${conversationId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'cs_messages', filter: `conversation_id=eq.${conversationId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['cs-messages', conversationId] });
          qc.invalidateQueries({ queryKey: ['cs-conversations'] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, qc]);

  return query;
};
