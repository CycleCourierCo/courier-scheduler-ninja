import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { sendMessage, addNote, fetchOrdersByIds } from "@/services/customerServiceInboxService";
import { toast } from "sonner";
import { Loader2, Send, Zap } from "lucide-react";
import type { CsConversation, CsMessage } from "@/types/customerService";
import { useAuth } from "@/contexts/AuthContext";
import { useCannedResponses } from "@/hooks/useCannedResponses";
import { fillCannedBody, suggestCannedResponses } from "@/lib/cannedMatch";
import type { CsCannedResponse } from "@/services/cannedResponseService";
import CannedResponsePicker from "./CannedResponsePicker";

interface Props {
  conversation: CsConversation;
  messages: CsMessage[];
  onSent?: () => void;
}

const TWENTYFOUR_HOURS = 24 * 60 * 60 * 1000;

const MessageComposer: React.FC<Props> = ({ conversation, messages, onSent }) => {
  const { user } = useAuth();
  const isClosed = conversation.status === 'closed';
  const [text, setText] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [linkedOrder, setLinkedOrder] = useState<any | null>(null);

  const { data: cannedResponses = [] } = useCannedResponses();

  const lastInbound = [...messages].reverse().find((m) => m.direction === 'in');
  const outsideWaWindow =
    conversation.channel === 'whatsapp' &&
    (!lastInbound || (Date.now() - new Date(lastInbound.created_at).getTime() > TWENTYFOUR_HOURS));

  // Linked order details are used to fill {{tracking_number}} / {{order_status}}.
  useEffect(() => {
    let cancelled = false;
    const id = conversation.linked_order_id;
    if (!id) { setLinkedOrder(null); return; }
    fetchOrdersByIds([id])
      .then((rows) => { if (!cancelled) setLinkedOrder(rows?.[0] ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [conversation.linked_order_id]);

  const suggestions = useMemo(
    () => (isNote ? [] : suggestCannedResponses(lastInbound?.body_text, cannedResponses)),
    [isNote, lastInbound?.body_text, cannedResponses],
  );

  const myName = (user as any)?.user_metadata?.name
    || (user?.email ? user.email.split('@')[0] : '')
    || 'Cycle Courier Co.';

  const insert = (response: CsCannedResponse) => {
    const filled = fillCannedBody(response.body, {
      customerName: conversation.contact?.display_name
        ? conversation.contact.display_name.split(' ')[0]
        : null,
      ticketRef: conversation.ticket_ref,
      trackingNumber: linkedOrder?.tracking_number || linkedOrder?.customer_order_number || null,
      orderStatus: linkedOrder?.status || null,
      myName,
    });
    setText(filled);
  };

  const send = async () => {
    const body = text.trim();
    if (!body || isClosed) return;
    setSending(true);
    try {
      if (isNote) {
        if (!user?.id) throw new Error('Not signed in');
        await addNote(conversation.id, body, user.id);
        toast.success("Internal note added");
      } else {
        await sendMessage({ conversationId: conversation.id, bodyText: body });
        toast.success(conversation.channel === 'email' ? "Email sent" : "WhatsApp sent");
      }
      setText("");
      onSent?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (isClosed) {
    return (
      <div className="border-t p-3 bg-background">
        <div className="text-xs text-muted-foreground bg-muted border rounded p-3 text-center">
          This ticket is closed. Reopen it to reply or add a note.
        </div>
      </div>
    );
  }

  return (
    <div className="border-t p-3 space-y-2 bg-background">
      {outsideWaWindow && !isNote && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          The WhatsApp 24h reply window is closed. Free-form messages may be rejected — use an approved WhatsApp template, or send an internal note.
        </div>
      )}

      <div className="flex items-center flex-wrap gap-2">
        <CannedResponsePicker responses={cannedResponses} onPick={insert} disabled={sending} />
        {suggestions.length > 0 && (
          <>
            <span className="text-[11px] text-muted-foreground">Suggested:</span>
            {suggestions.map((s) => (
              <Button
                key={s.id}
                variant="secondary"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={sending}
                onClick={() => insert(s)}
                title="Prefill this reply"
              >
                <Zap className="h-3 w-3 mr-1" />{s.title}
              </Button>
            ))}
          </>
        )}
      </div>

      <Textarea
        rows={3}
        placeholder={isNote ? "Add an internal note (not sent to customer)…" : `Reply via ${conversation.channel}…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send();
        }}
        className={isNote ? "bg-yellow-50 border-yellow-200" : ""}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch id="note-toggle" checked={isNote} onCheckedChange={setIsNote} />
          <Label htmlFor="note-toggle" className="text-xs cursor-pointer">Internal note</Label>
        </div>
        <Button onClick={send} disabled={sending || !text.trim()} size="sm">
          {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
          {isNote ? 'Save note' : 'Send'}
        </Button>
      </div>
    </div>
  );
};

export default MessageComposer;
