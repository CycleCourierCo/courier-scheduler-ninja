import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useConversation, useConversations, useMessages } from "@/hooks/useConversations";
import { markConversationRead, syncInboundEmails, fetchQueueCounts } from "@/services/customerServiceInboxService";
import ConversationList from "@/components/inbox/ConversationList";
import ConversationHeader from "@/components/inbox/ConversationHeader";
import MessageThread from "@/components/inbox/MessageThread";
import MessageComposer from "@/components/inbox/MessageComposer";
import ContextPanel from "@/components/inbox/ContextPanel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCsQueues, useCsStaff } from "@/hooks/useCsQueues";
import { CS_PRIORITIES, type CsPriority } from "@/types/customerService";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Inbox, Mail, MessageCircle, Maximize2, Minimize2, PanelRight, RefreshCw, Settings, SlidersHorizontal } from "lucide-react";

const CustomerServiceInbox: React.FC = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<'open'|'pending'|'snoozed'|'closed'|'all'>('open');
  const [channel, setChannel] = useState<'all'|'email'|'whatsapp'>('all');
  const [scope, setScope] = useState<'all'|'mine'|'unassigned'>('all');
  const [queueId, setQueueId] = useState<string>('all');
  const [priority, setPriority] = useState<CsPriority | 'all'>('all');
  const [sort, setSort] = useState<'recent'|'due'|'priority'>('due');
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [suppressAutoSelect, setSuppressAutoSelect] = useState(false);
  // Layout controls so the conversation can take almost the whole screen.
  const [focusMode, setFocusMode] = useState(false);
  const [showContext, setShowContext] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const clearSelection = () => {
    setSuppressAutoSelect(true);
    navigate('/inbox', { replace: true });
  };

  const { data: queues = [] } = useCsQueues();
  const { data: staff = [] } = useCsStaff();
  const { data: queueCounts = {} } = useQuery({
    queryKey: ['cs-queue-counts'],
    queryFn: fetchQueueCounts,
    staleTime: 15_000,
  });

  const staffNames = useMemo(
    () => Object.fromEntries(staff.map(s => [s.id, s.name || s.email || 'Staff'])),
    [staff],
  );

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncInboundEmails();
      queryClient.invalidateQueries({ queryKey: ['cs-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['cs-queue-counts'] });
      const imported = result?.imported ?? 0;
      const acks = result?.acks_sent ?? 0;
      const ackNote = acks > 0
        ? ` — ${acks} confirmation${acks === 1 ? '' : 's'} sent`
        : '';
      toast.success(imported > 0
        ? `${imported} new email${imported === 1 ? '' : 's'} added to the inbox${ackNote}`
        : (acks > 0 ? `Inbox is up to date${ackNote}` : 'Inbox is up to date'));
    } catch (err) {
      toast.error('Could not check for new emails. Please try again.');
      console.error('Inbox sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const params = useMemo(() => ({
    status,
    channel,
    assignedToMe: scope === 'mine',
    unassigned: scope === 'unassigned',
    search,
    userId: user?.id,
    queueId,
    priority,
    sort,
  }), [status, channel, scope, search, user?.id, queueId, priority, sort]);

  const { data: conversations = [], isLoading } = useConversations(params);
  const { data: conversation } = useConversation(conversationId);
  const { data: messages = [] } = useMessages(conversationId);

  const totalOverdue = useMemo(
    () => Object.values(queueCounts).reduce((sum, c) => sum + c.overdue, 0),
    [queueCounts],
  );

  // Auto-select first conversation on mount/desktop
  useEffect(() => {
    if (!suppressAutoSelect && !conversationId && conversations.length) {
      navigate(`/inbox/${conversations[0].id}`, { replace: true });
    }
  }, [conversationId, conversations, navigate, suppressAutoSelect]);

  // Mark as read on open
  useEffect(() => {
    if (conversation && conversation.unread_count > 0) {
      markConversationRead(conversation.id).catch(() => {});
    }
  }, [conversation?.id, conversation?.unread_count]);

  return (
    <Layout>
      <div className="w-full px-2 md:px-4 py-2 flex-1 flex flex-col min-h-0">
        <div className="flex items-center flex-wrap gap-2 mb-2">
          <Inbox className="h-4 w-4 text-primary" />
          <h1 className="text-base font-semibold">Customer Service Inbox</h1>
          {totalOverdue > 0 && (
            <Badge className="bg-destructive text-destructive-foreground border-transparent">
              {totalOverdue} past reply time
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setFocusMode(f => !f)}
              title={focusMode ? 'Show ticket list' : 'Give the chat the whole screen'}
            >
              {focusMode ? <Minimize2 className="h-3.5 w-3.5 mr-1" /> : <Maximize2 className="h-3.5 w-3.5 mr-1" />}
              {focusMode ? 'Exit full screen' : 'Full screen chat'}
            </Button>
            <Button
              variant={showContext ? 'secondary' : 'outline'}
              size="sm"
              className="h-8 hidden lg:inline-flex"
              onClick={() => setShowContext(s => !s)}
              title="Show or hide the contact and order panel"
            >
              <PanelRight className="h-3.5 w-3.5 mr-1" />Details
            </Button>
            <Button variant="outline" size="sm" className="h-8" asChild>
              <Link to="/inbox/queues">
                <Settings className="h-3.5 w-3.5 mr-1" />Queues
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Checking…' : 'Sync now'}
            </Button>
          </div>
        </div>

        {/* Queue tabs with live counts — hidden while the chat is full screen */}
        {!focusMode && (
          <div className="flex gap-1 flex-wrap mb-2">
            <Button
              variant={queueId === 'all' ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setQueueId('all')}
            >
              All queues
            </Button>
            {queues.filter(q => q.is_active).map(q => {
              const c = queueCounts[q.id];
              return (
                <Button
                  key={q.id}
                  variant={queueId === q.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => setQueueId(q.id)}
                >
                  {q.name}
                  {c?.open ? <span className="opacity-80">{c.open}</span> : null}
                  {c?.overdue ? (
                    <span className="text-destructive font-medium">!{c.overdue}</span>
                  ) : null}
                </Button>
              );
            })}
          </div>
        )}

        <div
          className={`grid grid-cols-1 gap-2 h-[calc(100dvh-130px)] min-h-[520px] ${
            focusMode
              ? 'md:grid-cols-1'
              : showContext
                ? 'md:grid-cols-[260px_1fr] lg:grid-cols-[260px_minmax(0,1fr)_280px]'
                : 'md:grid-cols-[260px_minmax(0,1fr)]'
          }`}
        >
          {/* LEFT — list + filters */}
          {!focusMode && (
            <div className="border rounded-md flex flex-col bg-card overflow-hidden min-h-0">
              <div className="p-2 border-b space-y-2">
                <div className="flex gap-1">
                  <Input
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button
                    variant={showFilters ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setShowFilters(f => !f)}
                    title="Show or hide filters"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    {showFilters ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
                  </Button>
                </div>
                {showFilters && (
                  <>
                    <div className="flex gap-1">
                      <Tabs value={scope} onValueChange={(v) => setScope(v as any)} className="flex-1">
                        <TabsList className="h-7 w-full grid grid-cols-3">
                          <TabsTrigger value="all" className="text-[11px] h-6">All</TabsTrigger>
                          <TabsTrigger value="mine" className="text-[11px] h-6">Mine</TabsTrigger>
                          <TabsTrigger value="unassigned" className="text-[11px] h-6">Unass.</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <div className="flex gap-1">
                      <Button variant={channel === 'all' ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs flex-1" onClick={() => setChannel('all')}>All</Button>
                      <Button variant={channel === 'email' ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs flex-1" onClick={() => setChannel('email')}>
                        <Mail className="h-3 w-3 mr-1" />Email
                      </Button>
                      <Button variant={channel === 'whatsapp' ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs flex-1" onClick={() => setChannel('whatsapp')}>
                        <MessageCircle className="h-3 w-3 mr-1" />WA
                      </Button>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {(['open','pending','snoozed','closed','all'] as const).map(s => (
                        <Button
                          key={s}
                          variant={status === s ? 'secondary' : 'ghost'}
                          size="sm"
                          className="h-6 px-2 text-[11px] capitalize"
                          onClick={() => setStatus(s)}
                        >{s}</Button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <Select value={priority} onValueChange={(v) => setPriority(v as CsPriority | 'all')}>
                        <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any priority</SelectItem>
                          {CS_PRIORITIES.map(p => (
                            <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                        <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="due">Reply time</SelectItem>
                          <SelectItem value="priority">Priority</SelectItem>
                          <SelectItem value="recent">Most recent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <ConversationList
                  conversations={conversations}
                  selectedId={conversationId || null}
                  onSelect={(id) => { setSuppressAutoSelect(false); navigate(`/inbox/${id}`); }}
                  isLoading={isLoading}
                  staffNames={staffNames}
                />
              </div>
            </div>
          )}

          {/* MIDDLE — thread */}
          <div className="border rounded-md flex flex-col bg-card overflow-hidden min-h-0">
            {conversation ? (
              <>
                <ConversationHeader conversation={conversation} onDismiss={clearSelection} />
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <MessageThread messages={messages} />
                </div>
                <MessageComposer conversation={conversation} messages={messages} />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-8">
                Select a conversation to view messages.
              </div>
            )}
          </div>

          {/* RIGHT — context */}
          {!focusMode && showContext && (
            <div className="border rounded-md bg-card overflow-y-auto hidden lg:block min-h-0">
              {conversation && <ContextPanel conversation={conversation} />}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default CustomerServiceInbox;
