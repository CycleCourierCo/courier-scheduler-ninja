import React from "react";
import { Check, CheckCheck, AlertCircle, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { CsDeliveryEvent, CsDeliveryStatus } from "@/types/customerService";

const LABELS: Record<string, string> = {
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Link opened",
  bounced: "Bounced — the address did not accept it",
  complained: "Marked as spam by the recipient",
  failed: "Could not be sent",
  delayed: "Delivery delayed, still trying",
};

interface Props {
  status?: CsDeliveryStatus | null;
  events?: CsDeliveryEvent[] | null;
  className?: string;
}

const MessageDeliveryTicks: React.FC<Props> = ({ status, events, className }) => {
  if (!status) return null;

  const problem = status === "bounced" || status === "complained" || status === "failed";
  const opened = status === "opened" || status === "clicked";
  const delivered = status === "delivered";

  const icon = problem
    ? <AlertCircle className="h-3 w-3" />
    : status === "delayed"
      ? <Clock className="h-3 w-3" />
      : opened || delivered
        ? <CheckCheck className="h-3 w-3" />
        : <Check className="h-3 w-3" />;

  const history = (events || []).map(e => `${LABELS[e.type] || e.type} · ${format(new Date(e.at), 'PP p')}`);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1",
            problem && "text-destructive-foreground",
            opened && "opacity-100 font-medium",
            className,
          )}
          aria-label={LABELS[status] || status}
        >
          {icon}
          <span className="sr-only">{LABELS[status] || status}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div className="font-medium">{LABELS[status] || status}</div>
        {history.length > 0 && (
          <div className="mt-1 space-y-0.5 opacity-80">
            {history.map((h, i) => <div key={i}>{h}</div>)}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

export default MessageDeliveryTicks;
