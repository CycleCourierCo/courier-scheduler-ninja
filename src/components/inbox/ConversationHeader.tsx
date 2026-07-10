import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateConversation } from "@/services/customerServiceInboxService";
import type { CsConversation, CsConversationStatus } from "@/types/customerService";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, MessageCircle } from "lucide-react";

interface Props { conversation: CsConversation }

const STATUSES: CsConversationStatus[] = ['open','pending','snoozed','closed'];

const ConversationHeader: React.FC<Props> = ({ conversation }) => {
  const qc = useQueryClient();
  const Icon = conversation.channel === 'email' ? Mail : MessageCircle;

  const setStatus = async (s: CsConversationStatus) => {
    try {
      await updateConversation(conversation.id, { status: s } as any);
      toast.success(`Status: ${s}`);
      qc.invalidateQueries({ queryKey: ['cs-conversations'] });
      qc.invalidateQueries({ queryKey: ['cs-conversation', conversation.id] });
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
  };

  return (
    <div className="border-b px-4 py-3 flex items-center gap-3 bg-background">
      <Icon className={`h-4 w-4 ${conversation.channel === 'email' ? 'text-blue-600' : 'text-green-600'}`} />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {conversation.contact?.display_name || conversation.contact?.handle || 'Unknown'}
        </div>
        {conversation.subject && (
          <div className="text-xs text-muted-foreground truncate">{conversation.subject}</div>
        )}
      </div>
      <Select value={conversation.status} onValueChange={(v) => setStatus(v as CsConversationStatus)}>
        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ConversationHeader;
