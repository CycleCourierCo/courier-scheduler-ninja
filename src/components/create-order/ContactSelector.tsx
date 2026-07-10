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
          className="w-full justify-between"
          disabled={isLoading}
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            {selectedContact ? (
              <span className="truncate">
                {selectedContact.name}
                {selectedContact.email && (
                  <span className="text-muted-foreground ml-2">
                    ({selectedContact.email})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">
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
