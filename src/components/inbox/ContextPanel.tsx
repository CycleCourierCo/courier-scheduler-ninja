import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { fetchOrdersByIds, searchOrdersForLink, updateConversation } from "@/services/customerServiceInboxService";
import type { CsConversation } from "@/types/customerService";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  conversation: CsConversation;
}

const OrderRow: React.FC<{ o: any; onLink?: () => void; onUnlink?: () => void; linked?: boolean }> = ({ o, onLink, onUnlink, linked }) => (
  <div className="flex items-center justify-between gap-2 text-xs border rounded p-2">
    <div className="min-w-0 flex-1">
      <div className="font-medium truncate">{o.tracking_number || o.customer_order_number || o.id.slice(0,8)}</div>
      <div className="text-muted-foreground truncate">
        {o.sender?.name} → {o.receiver?.name}
      </div>
      <div className="text-muted-foreground">{o.status}</div>
    </div>
    <div className="flex items-center gap-1">
      <Link to={`/orders/${o.id}`} target="_blank">
        <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-3 w-3" /></Button>
      </Link>
      {linked
        ? <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onUnlink}><X className="h-3 w-3" /></Button>
        : <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onLink}>Link</Button>}
    </div>
  </div>
);

const ContextPanel: React.FC<Props> = ({ conversation }) => {
  const qc = useQueryClient();
  const [linkedOrder, setLinkedOrder] = useState<any | null>(null);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids: string[] = [];
      if (conversation.linked_order_id) ids.push(conversation.linked_order_id);
      ids.push(...(conversation.suggested_order_ids || []).filter(id => id !== conversation.linked_order_id));
      const rows = await fetchOrdersByIds(ids);
      if (cancelled) return;
      setLinkedOrder(rows.find(r => r.id === conversation.linked_order_id) || null);
      setSuggested(rows.filter(r => r.id !== conversation.linked_order_id));
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [conversation.id, conversation.linked_order_id, conversation.suggested_order_ids]);

  const linkOrder = async (id: string) => {
    try {
      await updateConversation(conversation.id, {
        linked_order_id: id,
        auto_link_locked: true,
      } as any);
      toast.success("Order linked");
      qc.invalidateQueries({ queryKey: ['cs-conversation', conversation.id] });
      qc.invalidateQueries({ queryKey: ['cs-conversations'] });
    } catch (e: any) { toast.error(e?.message || "Failed to link"); }
  };

  const unlink = async () => {
    try {
      await updateConversation(conversation.id, { linked_order_id: null } as any);
      toast.success("Order unlinked");
      qc.invalidateQueries({ queryKey: ['cs-conversation', conversation.id] });
      qc.invalidateQueries({ queryKey: ['cs-conversations'] });
    } catch (e: any) { toast.error(e?.message || "Failed to unlink"); }
  };

  const runSearch = async () => {
    const t = search.trim();
    if (!t) { setSearchResults([]); return; }
    try {
      const rows = await searchOrdersForLink(t);
      setSearchResults(rows);
    } catch (e: any) { toast.error(e?.message || "Search failed"); }
  };

  return (
    <div className="p-3 space-y-4 text-sm">
      <Card className="p-3">
        <div className="text-xs text-muted-foreground uppercase mb-1">Contact</div>
        <div className="font-medium">{conversation.contact?.display_name || conversation.contact?.handle}</div>
        <div className="text-xs text-muted-foreground break-all">{conversation.contact?.handle}</div>
        <Badge variant="outline" className="mt-2 text-[10px] capitalize">{conversation.channel}</Badge>
      </Card>

      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Linked order</div>
        {linkedOrder ? (
          <OrderRow o={linkedOrder} linked onUnlink={unlink} />
        ) : (
          <div className="text-xs text-muted-foreground">No order linked yet.</div>
        )}
      </div>

      {suggested.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Suggested matches</div>
          <div className="space-y-2">
            {suggested.map(o => <OrderRow key={o.id} o={o} onLink={() => linkOrder(o.id)} />)}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Find an order</div>
        <div className="flex gap-1">
          <Input
            placeholder="Tracking # or order #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            className="h-8 text-xs"
          />
          <Button size="icon" variant="outline" onClick={runSearch} className="h-8 w-8 shrink-0">
            <Search className="h-3 w-3" />
          </Button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 space-y-2">
            {searchResults.map(o => <OrderRow key={o.id} o={o} onLink={() => linkOrder(o.id)} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContextPanel;
