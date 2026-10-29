import React, { useState } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Att = { url?: string; filename?: string; content_type?: string; download_failed?: boolean };

const safeUrl = (u?: string) => (u && /^https:\/\//.test(u) ? u : undefined);

const MessageAttachments: React.FC<{ messageId: string; attachments: Att[] }> = ({ messageId, attachments }) => {
  const [busy, setBusy] = useState<number | null>(null);

  const retry = async (index: number) => {
    setBusy(index);
    const { data, error } = await supabase.functions.invoke('cs-whatsapp-media-retry', { body: { message_id: messageId, index } });
    setBusy(null);
    if (error || !(data as any)?.ok) toast.error("WhatsApp still won't give us this file. Ask the customer to resend it.");
    else toast.success("File downloaded");
  };

  return (
    <div className="mt-2 flex flex-col gap-2">
      {attachments.map((a, i) => {
        const url = safeUrl(a.url);
        const type = (a.content_type || '').toLowerCase();
        const name = a.filename || `attachment-${i + 1}`;
        if (a.download_failed || !url) {
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="opacity-80">Media couldn't be downloaded ({name})</span>
              <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px]"
                disabled={busy === i} onClick={() => retry(i)}>
                <RefreshCw className="h-3 w-3 mr-1" /> Retry
              </Button>
            </div>
          );
        }
        if (type.startsWith('image/')) {
          return (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
              <img src={url} alt={name} loading="lazy" className="max-h-64 rounded-md border" />
            </a>
          );
        }
        if (type.startsWith('video/')) {
          return <video key={i} src={url} controls preload="metadata" className="max-h-64 rounded-md border" />;
        }
        if (type.startsWith('audio/')) {
          return <audio key={i} src={url} controls preload="metadata" className="w-full max-w-xs" />;
        }
        return (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs underline">
            <FileText className="h-3.5 w-3.5" /> {name}
          </a>
        );
      })}
    </div>
  );
};

export default MessageAttachments;
