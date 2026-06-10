import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useConversation, useConversations, useMessages } from "@/hooks/useConversations";
import { markConversationRead } from "@/services/customerServiceInboxService";
import ConversationList from "@/components/inbox/ConversationList";
import ConversationHeader from "@/components/inbox/ConversationHeader";
import MessageThread from "@/components/inbox/MessageThread";
import MessageComposer from "@/components/inbox/MessageComposer";
import ContextPanel from "@/components/inbox/ContextPanel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, Mail, MessageCircle } from "lucide-react";

const CustomerServiceInbox: React.FC = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user } = useAuth();

  const [status, setStatus] = useState<'open'|'pending'|'snoozed'|'closed'|'all'>('open');
  const [channel, setChannel] = useState<'all'|'email'|'whatsapp'>('all');
  const [scope, setScope] = useState<'all'|'mine'|'unassigned'>('all');
  const [search, setSearch] = useState('');

  const params = useMemo(() => ({
    status,
    channel,
    assignedToMe: scope === 'mine',
    unassigned: scope === 'unassigned',
    search,
    userId: user?.id,
  }), [status, channel, scope, search, user?.id]);

  const { data: conversations = [], isLoading } = useConversations(params);
  const { data: conversation } = useConversation(conversationId);
  const { data: messages = [] } = useMessages(conversationId);

  // Auto-select first conversation on mount/desktop
  useEffect(() => {
    if (!conversationId && conversations.length) {
      navigate(`/inbox/${conversations[0].id}`, { replace: true });
    }
  }, [conversationId, conversations, navigate]);

  // Mark as read on open
  useEffect(() => {
    if (conversation && conversation.unread_count > 0) {
      markConversationRead(conversation.id).catch(() => {});
    }
  }, [conversation?.id, conversation?.unread_count]);

  return (
    <Layout>
      <div className="container mx-auto px-2 md:px-4 py-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Customer Service Inbox</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr_300px] gap-3 flex-1 min-h-[70vh]">
          {/* LEFT — list + filters */}
          <div className="border rounded-md flex flex-col bg-card overflow-hidden">
            <div className="p-2 border-b space-y-2">
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
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
            </div>
            <div className="flex-1 overflow-y-auto">
              <ConversationList
                conversations={conversations}
                selectedId={conversationId || null}
                onSelect={(id) => navigate(`/inbox/${id}`)}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* MIDDLE — thread */}
          <div className="border rounded-md flex flex-col bg-card overflow-hidden min-h-[400px]">
            {conversation ? (
              <>
                <ConversationHeader conversation={conversation} />
                <div className="flex-1 overflow-y-auto">
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
          <div className="border rounded-md bg-card overflow-y-auto hidden md:block">
            {conversation && <ContextPanel conversation={conversation} />}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CustomerServiceInbox;
