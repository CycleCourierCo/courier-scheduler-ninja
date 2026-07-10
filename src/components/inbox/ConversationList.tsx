import React from "react";
import { Mail, MessageCircle, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CsConversation } from "@/types/customerService";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface Props {
  conversations: CsConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading?: boolean;
}

const ConversationList: React.FC<Props> = ({ conversations, selectedId, onSelect, isLoading }) => {
  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading conversations…</div>;
  }
  if (!conversations.length) {
    return <div className="p-4 text-sm text-muted-foreground">No conversations match your filters.</div>;
  }

  return (
    <div className="divide-y">
      {conversations.map((c) => {
        const isActive = c.id === selectedId;
        const Icon = c.channel === 'email' ? Mail : MessageCircle;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              "w-full text-left px-3 py-3 hover:bg-muted transition-colors",
              isActive && "bg-muted",
            )}
          >
            <div className="flex items-start gap-2">
              <Icon className={cn("h-4 w-4 mt-1 shrink-0",
                c.channel === 'email' ? "text-blue-600" : "text-green-600")} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium truncate text-sm">
                    {c.contact?.display_name || c.contact?.handle || 'Unknown'}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                  </div>
                </div>
                {c.subject && (
                  <div className="text-xs text-foreground truncate">{c.subject}</div>
                )}
                <div className="text-xs text-muted-foreground truncate">
                  {c.last_message_preview || '—'}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {c.unread_count > 0 && (
                    <Badge variant="default" className="h-4 px-1.5 text-[10px]">
                      {c.unread_count} new
                    </Badge>
                  )}
                  {c.linked_order_id && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px] gap-0.5">
                      <Package className="h-3 w-3" /> order
                    </Badge>
                  )}
                  <Badge variant="outline" className="h-4 px-1.5 text-[10px] capitalize">
                    {c.status}
                  </Badge>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ConversationList;
