import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Zap } from "lucide-react";
import type { CsCannedResponse } from "@/services/cannedResponseService";

interface Props {
  responses: CsCannedResponse[];
  onPick: (response: CsCannedResponse) => void;
  disabled?: boolean;
}

const CannedResponsePicker: React.FC<Props> = ({ responses, onPick, disabled }) => {
  const [open, setOpen] = useState(false);

  const categories = Array.from(new Set(responses.map(r => r.category || 'General')));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={disabled}>
          <Zap className="h-3.5 w-3.5 mr-1" />Instant responses
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,26rem)] p-0">
        <Command>
          <CommandInput placeholder="Search instant responses…" className="text-sm" />
          <CommandList className="max-h-72">
            <CommandEmpty className="py-4 text-xs text-center text-muted-foreground">
              Nothing saved yet — add some in Queues → Instant responses.
            </CommandEmpty>
            {categories.map((cat) => (
              <CommandGroup key={cat} heading={cat}>
                {responses.filter(r => (r.category || 'General') === cat).map((r) => (
                  <CommandItem
                    key={r.id}
                    value={`${r.title} ${r.category} ${(r.keywords || []).join(' ')}`}
                    onSelect={() => { onPick(r); setOpen(false); }}
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="text-sm font-medium">{r.title}</span>
                    <span className="text-[11px] text-muted-foreground line-clamp-2">
                      {r.body.replace(/\s+/g, ' ').slice(0, 120)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CannedResponsePicker;
