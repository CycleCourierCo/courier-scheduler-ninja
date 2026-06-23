import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mail, MailCheck, MailOpen, MailX, MousePointerClick, Clock, AlertTriangle } from "lucide-react";

interface EmailDeliveryStatusProps {
  orderId?: string;
  side: "sender" | "receiver";
}

type EventRow = {
  event_type: string;
  created_at: string;
  recipient: string | null;
};

// Rank events by lifecycle progress so we surface the most meaningful status.
const RANK: Record<string, number> = {
  sent: 1,
  delivery_delayed: 2,
  delivered: 3,
  opened: 4,
  clicked: 5,
  bounced: 6,
  complained: 7,
};

const STYLES: Record<string, { label: string; className: string; Icon: React.ComponentType<any> }> = {
  sent: { label: "Sent", className: "bg-slate-100 text-slate-700 border-slate-200", Icon: Mail },
  delivery_delayed: { label: "Delayed", className: "bg-amber-100 text-amber-800 border-amber-200", Icon: Clock },
  delivered: { label: "Delivered", className: "bg-emerald-100 text-emerald-800 border-emerald-200", Icon: MailCheck },
  opened: { label: "Opened", className: "bg-blue-100 text-blue-800 border-blue-200", Icon: MailOpen },
  clicked: { label: "Clicked", className: "bg-indigo-100 text-indigo-800 border-indigo-200", Icon: MousePointerClick },
  bounced: { label: "Bounced", className: "bg-red-100 text-red-800 border-red-200", Icon: MailX },
  complained: { label: "Complained", className: "bg-red-100 text-red-800 border-red-200", Icon: AlertTriangle },
};

const EmailDeliveryStatus: React.FC<EmailDeliveryStatusProps> = ({ orderId, side }) => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    const fetchEvents = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("email_delivery_events")
        .select("event_type, created_at, recipient")
        .eq("order_id", orderId)
        .eq("side", side)
        .order("created_at", { ascending: false })
        .limit(25);
      if (!cancelled) {
        if (!error && data) setEvents(data as EventRow[]);
        setLoading(false);
      }
    };

    fetchEvents();

    const channel = supabase
      .channel(`email-events-${orderId}-${side}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "email_delivery_events", filter: `order_id=eq.${orderId}` },
        (payload) => {
          const row = payload.new as any;
          if (row.side === side) {
            setEvents((prev) => [{ event_type: row.event_type, created_at: row.created_at, recipient: row.recipient }, ...prev]);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [orderId, side]);

  if (!orderId) return null;
  if (loading && events.length === 0) return null;
  if (events.length === 0) {
    return (
      <Badge variant="outline" className="text-xs text-gray-500">
        No email sent
      </Badge>
    );
  }

  // Latest event becomes the primary status, but rank bounced/complained above engagement.
  const top = [...events].sort((a, b) => (RANK[b.event_type] ?? 0) - (RANK[a.event_type] ?? 0))[0];
  const style = STYLES[top.event_type] ?? STYLES.sent;
  const Icon = style.Icon;
  const seen = new Set<string>();
  const history = events.filter((e) => {
    if (seen.has(e.event_type)) return false;
    seen.add(e.event_type);
    return true;
  });

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-xs gap-1 cursor-help ${style.className}`}>
            <Icon className="h-3 w-3" />
            Email {style.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p className="font-medium">Email delivery</p>
            {history.map((e) => {
              const s = STYLES[e.event_type] ?? { label: e.event_type };
              return (
                <div key={e.event_type} className="flex justify-between gap-3">
                  <span>{s.label}</span>
                  <span className="text-gray-400">
                    {new Date(e.created_at).toLocaleString("en-GB", { timeZone: "Europe/London" })}
                  </span>
                </div>
              );
            })}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default EmailDeliveryStatus;
