import React from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface UnassignedStop {
  stop_id: string;
  order_id: string;
  type: string;
  contact_name: string;
  address: string;
  postcode_prefix: string;
  region: string;
}

interface UnassignedStopsPanelProps {
  stops: UnassignedStop[];
}

const UnassignedStopsPanel: React.FC<UnassignedStopsPanelProps> = ({ stops }) => {
  const [open, setOpen] = React.useState(false);

  if (stops.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm hover:bg-destructive/15 transition-colors">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span className="font-medium text-destructive">
          {stops.length} unassigned stop{stops.length !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {open ? 'Click to collapse' : 'Click to expand'}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1.5">
        {stops.map((stop) => (
          <div key={stop.stop_id} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50 border border-border/30">
            <Badge variant={stop.type === 'collection' ? 'progress' : 'active'} className="text-[10px] px-1.5 py-0">
              {stop.type === 'collection' ? 'P' : 'D'}
            </Badge>
            <span className="font-medium text-xs">{stop.contact_name}</span>
            <span className="text-xs text-muted-foreground">{stop.postcode_prefix}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">{stop.region}</Badge>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default UnassignedStopsPanel;
