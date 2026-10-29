import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Contact, searchContacts } from "@/services/contactService";

interface ContactSelectorProps {
  /** Limit the search to this account's address book. Omit to search all contacts (admins only via RLS). */
  userId?: string | null;
  onSelect: (contact: Contact) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Search-as-you-type address book. Fetches at most 30 matches per query
 * instead of loading the whole book up front.
 */
export const ContactSelector = ({
  userId,
  onSelect,
  placeholder = "Select from address book...",
  disabled = false,
}: ContactSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    const t = setTimeout(() => {
      setLoading(true);
      setFailed(false);
      searchContacts({ userId: userId ?? null, search })
        .then((data) => { if (id === requestId.current) setRows(data); })
        .catch((err) => {
          console.error("Contact search failed", err);
          if (id === requestId.current) { setRows([]); setFailed(true); }
        })
        .finally(() => { if (id === requestId.current) setLoading(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [open, search, userId]);

  // Different account picked → clear the old selection
  useEffect(() => { setSelected(null); }, [userId]);

  const handleSelect = (contact: Contact) => {
    setSelected(contact);
    onSelect(contact);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-10 w-full min-w-0 max-w-full justify-between py-2"
          disabled={disabled}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            {selected ? (
              <span className="flex min-w-0 flex-col items-start overflow-hidden text-left">
                <span className="w-full truncate">{selected.name}</span>
                {selected.email && (
                  <span className="w-full truncate text-xs text-muted-foreground">{selected.email}</span>
                )}
              </span>
            ) : (
              <span className="min-w-0 truncate text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="border-b p-2">
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, postcode or street..."
            className="h-9"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1" role="listbox">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching...
            </div>
          ) : failed ? (
            <p className="py-6 text-center text-sm text-destructive">Couldn't load contacts. Try again.</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {search.trim().length >= 2 ? "No contacts found." : "No saved contacts yet."}
            </p>
          ) : (
            <>
              {search.trim().length < 2 && (
                <p className="px-2 py-1 text-xs text-muted-foreground">Recently used — type to search</p>
              )}
              {rows.map((contact) => (
                <button
                  type="button"
                  key={contact.id}
                  role="option"
                  aria-selected={selected?.id === contact.id}
                  onClick={() => handleSelect(contact)}
                  className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", selected?.id === contact.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex min-w-0 flex-col overflow-hidden">
                    <span className="truncate">{contact.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[contact.email, contact.postal_code].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
