import React, { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { CsMessage } from "@/types/customerService";
import { format } from "date-fns";
import { AlertCircle } from "lucide-react";
import DOMPurify from "dompurify";

interface Props {
  messages: CsMessage[];
}

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
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(m.body_html, {
                    USE_PROFILES: { html: true },
                    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
                    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
                  }),
                }}
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
              {m.status === 'failed' && (
                <span className="flex items-center gap-1 text-red-200">
                  <AlertCircle className="h-3 w-3" /> failed{m.error ? `: ${m.error}` : ''}
                </span>
              )}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};

export default MessageThread;
