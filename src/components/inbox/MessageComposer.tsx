import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { sendMessage, addNote } from "@/services/customerServiceInboxService";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import type { CsConversation, CsMessage } from "@/types/customerService";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  conversation: CsConversation;
  messages: CsMessage[];
  onSent?: () => void;
}

const TWENTYFOUR_HOURS = 24 * 60 * 60 * 1000;

const MessageComposer: React.FC<Props> = ({ conversation, messages, onSent }) => {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [sending, setSending] = useState(false);

  const lastInbound = [...messages].reverse().find((m) => m.direction === 'in');
  const outsideWaWindow =
    conversation.channel === 'whatsapp' &&
    (!lastInbound || (Date.now() - new Date(lastInbound.created_at).getTime() > TWENTYFOUR_HOURS));

  const send = async () => {
    const body = text.trim();
    if (!body) return;
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

  return (
    <div className="border-t p-3 space-y-2 bg-background">
      {outsideWaWindow && !isNote && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          The WhatsApp 24h reply window is closed. Free-form messages may be rejected — use an approved template via SendZen, or send an internal note.
        </div>
      )}
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
