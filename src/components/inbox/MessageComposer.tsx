import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { sendMessage, addNote, fetchOrdersByIds, uploadReplyAttachment } from "@/services/customerServiceInboxService";
import { waMediaSizeError } from "../../../supabase/functions/_shared/whatsappMedia";
import { toast } from "sonner";
import { Loader2, Send, Zap, Paperclip, X } from "lucide-react";
import type { CsConversation, CsMessage } from "@/types/customerService";
import { useAuth } from "@/contexts/AuthContext";
import { useCannedResponses } from "@/hooks/useCannedResponses";
import { fillCannedBody, suggestCannedResponses } from "@/lib/cannedMatch";
import type { CsCannedResponse } from "@/services/cannedResponseService";
import CannedResponsePicker from "./CannedResponsePicker";
import WhatsAppTemplateSender from "./WhatsAppTemplateSender";

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
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [linkedOrder, setLinkedOrder] = useState<any | null>(null);
  const [tplOpen, setTplOpen] = useState(false);

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

  // Auto-prefill the best suggestion once per customer message, only into an empty reply box.
  const autoFilledFor = React.useRef<string | null>(null);
  useEffect(() => {
    const key = lastInbound?.id ?? null;
    if (!key || isNote || suggestions.length === 0) return;
    if (autoFilledFor.current === key) return;
    autoFilledFor.current = key;
    if (!text.trim()) insert(suggestions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastInbound?.id, suggestions, isNote]);

  const MAX_FILE = 20 * 1024 * 1024;
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (conversation.channel === 'whatsapp' && !isNote) {
        const err = waMediaSizeError(f.type || 'application/octet-stream', f.size);
        if (err) { toast.error(`${f.name}: ${err}`); continue; }
      } else if (f.size > MAX_FILE) { toast.error(`${f.name} is over 20MB`); continue; }
      if (next.length >= 10) { toast.error("Up to 10 files per reply"); break; }
      next.push(f);
    }
    setFiles(next);
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && (isNote || files.length === 0)) || isClosed) return;
    setSending(true);
    try {
      if (isNote) {
        if (!user?.id) throw new Error('Not signed in');
        await addNote(conversation.id, body, user.id);
        toast.success("Internal note added");
      } else {
        const attachments = await Promise.all(files.map((f) => uploadReplyAttachment(conversation.id, f)));
        await sendMessage({ conversationId: conversation.id, bodyText: body, attachments });
        toast.success(conversation.channel === 'email' ? "Email sent" : "WhatsApp sent");
      }
      setText("");
      if (!isNote) setFiles([]);
      onSent?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (isClosed) {
    return (
      <div className="border-t p-3 bg-background shrink-0">
        <div className="text-xs text-muted-foreground bg-muted border rounded p-3 text-center">
          This ticket is closed. Reopen it to reply or add a note.
        </div>
      </div>
    );
  }

  return (
    <div className="border-t p-2 lg:p-3 space-y-2 bg-background shrink-0 max-h-[45dvh] overflow-y-auto">
      {conversation.channel === 'whatsapp' && (
        <WhatsAppTemplateSender open={tplOpen} onOpenChange={setTplOpen} conversationId={conversation.id} onSent={onSent}
          defaults={{
            customer_name: conversation.contact?.display_name?.split(' ')[0] || '',
            ticket_ref: conversation.ticket_ref,
            tracking_number: linkedOrder?.tracking_number || linkedOrder?.customer_order_number,
            reference: linkedOrder?.tracking_number || conversation.ticket_ref,
            order_status: linkedOrder?.status,
          }} />
      )}
      {outsideWaWindow && !isNote && (
        <div className="text-xs text-status-waiting bg-status-waiting/10 border border-status-waiting/40 rounded p-2">
          The WhatsApp 24h reply window is closed. Free-form messages will be rejected — send an approved template instead.
          <Button type="button" size="sm" variant="outline" className="ml-2 h-7 text-xs" onClick={() => setTplOpen(true)}>Send template</Button>
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
        className={`min-h-[60px] h-[60px] lg:h-auto max-h-[20dvh] ${isNote ? "bg-status-waiting/10 border-status-waiting/40" : ""}`}
      />
      {!isNote && files.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 max-w-full rounded border bg-muted px-2 py-0.5 text-xs">
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[160px]">{f.name}</span>
              <span className="text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
              <button type="button" aria-label={`Remove ${f.name}`} disabled={sending}
                onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Switch id="note-toggle" checked={isNote} onCheckedChange={setIsNote} />
          <Label htmlFor="note-toggle" className="text-xs cursor-pointer">Internal note</Label>
        </div>
        <div className="flex items-center gap-2">
          {!isNote && (
            <>
              <input ref={fileInput} type="file" multiple className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              <Button type="button" variant="outline" size="sm" disabled={sending}
                onClick={() => fileInput.current?.click()} aria-label="Attach files">
                <Paperclip className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button onClick={send} disabled={sending || (!text.trim() && (isNote || files.length === 0))} size="sm">
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            {isNote ? 'Save note' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MessageComposer;
