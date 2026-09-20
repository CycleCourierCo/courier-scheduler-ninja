import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { CsMessage } from "@/types/customerService";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import DOMPurify from "dompurify";
import MessageDeliveryTicks from "./MessageDeliveryTicks";

interface Props {
  messages: CsMessage[];
}

// Force safe link behaviour on any rendered anchor
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof Element && node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const sanitizeMessageHtml = (html: string) =>
  DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'base', 'noscript', 'template'],
    FORBID_ATTR: ['style', 'srcdoc', 'formaction', 'onerror', 'onload', 'onclick'],
    ALLOW_DATA_ATTR: false,
  });

const SYSTEM_LABELS: Record<string, string> = {
  ticket_closed: 'This ticket has been closed — the customer was emailed',
  ticket_acknowledged: 'Confirmation email sent to the customer',
  ticket_reopened: 'This ticket was reopened',
};

/** Closure and similar system emails collapse to a single line in the thread. */
const SystemLine: React.FC<{ message: CsMessage }> = ({ message }) => {
  const [open, setOpen] = useState(false);
  const label = SYSTEM_LABELS[message.system_event || ''] || 'System update';

  return (
    <div className="self-center w-full max-w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="mx-auto flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted"
      >
        <CheckCircle2 className="h-3 w-3" />
        <span>{label}</span>
        <span className="opacity-70">· {format(new Date(message.created_at), 'PP p')}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 rounded-lg border bg-muted/30 p-3 text-xs">
          {message.body_html ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(message.body_html) }}
            />
          ) : (
            <div className="whitespace-pre-wrap">{message.body_text || '(empty)'}</div>
          )}
        </div>
      )}
    </div>
  );
};

const MessageThread: React.FC<Props> = ({ messages }) => {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!messages.length) {
    return <div className="p-8 text-center text-sm text-muted-foreground">No messages yet.</div>;
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((m) => {
        if (m.system_event) return <SystemLine key={m.id} message={m} />;

        const isInbound = m.direction === 'in';
        const isNote = m.direction === 'note';
        return (
          <div
            key={m.id}
            className={cn(
              "max-w-[80%] rounded-lg px-3 py-2 text-sm",
              isNote && "bg-yellow-50 border border-yellow-200 text-yellow-900 self-center max-w-full w-full",
              isInbound && !isNote && "bg-muted self-start",
              !isInbound && !isNote && "bg-primary text-primary-foreground self-end",
            )}
          >
            {isNote && (
              <div className="text-[10px] uppercase tracking-wide font-semibold mb-1 opacity-70">
                Internal note
              </div>
            )}
            {m.body_html ? (
              <div
                className="prose prose-sm max-w-none [&_*]:!text-inherit"
                dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(m.body_html) }}
              />
            ) : (
              <div className="whitespace-pre-wrap">{m.body_text || '(empty)'}</div>
            )}
            {Array.isArray(m.attachments) && m.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {m.attachments.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener" className="text-xs underline">
                    {a.filename || `attachment-${i+1}`}
                  </a>
                ))}
              </div>
            )}
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] opacity-70">
              <span>{format(new Date(m.created_at), 'PP p')}</span>
              <span className="flex items-center gap-1">
                {m.status === 'failed' && (
                  <span className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> failed{m.error ? `: ${m.error}` : ''}
                  </span>
                )}
                {!isInbound && !isNote && m.status !== 'failed' && (
                  <MessageDeliveryTicks status={m.delivery_status} events={m.delivery_events} />
                )}
              </span>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};

export default MessageThread;
