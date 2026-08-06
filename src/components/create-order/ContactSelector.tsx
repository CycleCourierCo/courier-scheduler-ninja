import { useState } from "react";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Contact } from "@/services/contactService";

interface ContactSelectorProps {
  contacts: Contact[];
  onSelect: (contact: Contact) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export const ContactSelector = ({
  contacts,
  onSelect,
  isLoading = false,
  placeholder = "Select from address book...",
}: ContactSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (contact: Contact) => {
    setSelectedId(contact.id);
    onSelect(contact);
    setOpen(false);
  };

  const selectedContact = contacts.find((c) => c.id === selectedId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full min-w-0 max-w-full justify-between"
          disabled={isLoading}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            {selectedContact ? (
              <span className="flex min-w-0 flex-col items-start overflow-hidden text-left">
                <span className="w-full truncate">{selectedContact.name}</span>
                {selectedContact.email && (
                  <span className="w-full truncate text-xs text-muted-foreground">
                    {selectedContact.email}
                  </span>
                )}
              </span>
            ) : (
              <span className="min-w-0 truncate text-muted-foreground">
                {isLoading ? "Loading contacts..." : placeholder}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>

      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search contacts..." />
          <CommandList>
            <CommandEmpty>
              {contacts.length === 0
                ? "No saved contacts yet."
                : "No contacts found."}
            </CommandEmpty>
            <CommandGroup>
              {contacts.map((contact) => (
                <CommandItem
                  key={contact.id}
                  value={`${contact.name} ${contact.email || ""}`}
                  onSelect={() => handleSelect(contact)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedId === contact.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{contact.name}</span>
                    {contact.email && (
                      <span className="text-xs text-muted-foreground">
                        {contact.email}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
