import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateConversation, closeTicket, sendTicketConfirmation } from "@/services/customerServiceInboxService";
import type { CsConversation, CsConversationStatus, CsPriority } from "@/types/customerService";
import { CS_PRIORITIES } from "@/types/customerService";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, MessageCircle, Clock, CheckCircle2, Loader2, Send, AlertTriangle } from "lucide-react";
import { useCsQueues, useCsStaff } from "@/hooks/useCsQueues";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { describeDue, dueBadgeClass } from "@/lib/csTickets";

interface Props { conversation: CsConversation }

const STATUSES: CsConversationStatus[] = ['open','pending','snoozed','closed'];
const UNASSIGNED = '__unassigned__';

const ConversationHeader: React.FC<Props> = ({ conversation }) => {
  const qc = useQueryClient();
  const Icon = conversation.channel === 'email' ? Mail : MessageCircle;
  const { data: queues = [] } = useCsQueues();
  const { data: staff = [] } = useCsStaff();
  const due = describeDue(conversation.next_response_due_at);
  const [closing, setClosing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const isClosed = conversation.status === 'closed';
  const isEmail = conversation.channel === 'email';
  const confirmationSent = !!conversation.ack_sent_at;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['cs-conversations'] });
    qc.invalidateQueries({ queryKey: ['cs-conversation', conversation.id] });
    qc.invalidateQueries({ queryKey: ['cs-messages', conversation.id] });
    qc.invalidateQueries({ queryKey: ['cs-queue-counts'] });
  };

  const patch = async (p: Record<string, unknown>, message: string) => {
    try {
      await updateConversation(conversation.id, p as any);
      toast.success(message);
      refresh();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
  };

  const handleClose = async () => {
    if (closing || isClosed) return;
    setClosing(true);
    try {
      await closeTicket(conversation.id);
      toast.success('Ticket closed and the customer has been emailed');
      refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Could not close the ticket');
    } finally {
      setClosing(false);
    }
  };

  const handleStatusChange = (v: string) => {
    if (v === 'closed') { handleClose(); return; }
    patch({ status: v }, `Status: ${v}`);
  };

  const handleSendConfirmation = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      await sendTicketConfirmation(conversation.id, confirmationSent);
      toast.success('Confirmation email sent to the customer');
      refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Could not send the confirmation email');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="border-b px-4 py-3 bg-background space-y-2">
      <div className="flex items-center gap-3">
        <Icon className={cn("h-4 w-4", conversation.channel === 'email' ? "text-primary" : "text-success")} />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">
            {conversation.contact?.display_name || conversation.contact?.handle || 'Unknown'}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {conversation.ticket_ref && <span className="font-mono">{conversation.ticket_ref}</span>}
            {conversation.subject && <span className="truncate">{conversation.subject}</span>}
          </div>
        </div>
        {conversation.has_delivery_problem && (
          <Badge variant="destructive" className="h-5 px-2 text-[11px] gap-1 shrink-0">
            <AlertTriangle className="h-3 w-3" />Email problem
          </Badge>
        )}
        {due && (
          <Badge className={cn("h-5 px-2 text-[11px] gap-1 border-transparent shrink-0", dueBadgeClass(due))}>
            <Clock className="h-3 w-3" />{due.label}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          value={conversation.queue_id || ''}
          onValueChange={(v) => patch({ queue_id: v }, 'Queue updated')}
        >
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Queue" /></SelectTrigger>
          <SelectContent>
            {queues.filter(q => q.is_active || q.id === conversation.queue_id).map(q => (
              <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={conversation.priority}
          onValueChange={(v) => patch({ priority: v as CsPriority }, `Priority: ${v}`)}
        >
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CS_PRIORITIES.map(p => (
              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={conversation.assignee_id || UNASSIGNED}
          onValueChange={(v) => patch(
            { assignee_id: v === UNASSIGNED ? null : v },
            v === UNASSIGNED ? 'Returned to the queue' : 'Assigned',
          )}
        >
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Owner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            {staff.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={conversation.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {!isClosed && (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleClose} disabled={closing}>
            {closing
              ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
            Close ticket
          </Button>
        )}
      </div>
    </div>
  );
};

export default ConversationHeader;
