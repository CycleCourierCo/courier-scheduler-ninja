import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface QuickBooksCustomerOption {
  id: string;
  name: string;
  email: string | null;
}

export type BillingPartySide = "account" | "sender" | "receiver";

export interface BillingPartyDetails {
  side: BillingPartySide;
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  city?: string;
  postcode?: string;
}

export interface BillingParties {
  /** The account that booked the job. */
  account?: BillingPartyDetails;
  sender?: BillingPartyDetails;
  receiver?: BillingPartyDetails;
}

interface BillingCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Customers suggested by the edge function when auto-match failed. */
  suggestions?: QuickBooksCustomerOption[];
  triedEmails?: string[];
  /** Booking account / sender / receiver contact details from the job, if it has one. */
  parties?: BillingParties;
  isSubmitting?: boolean;
  onConfirm: (selection: {
    quickbooksCustomerId?: string;
    billingEmailOverride?: string;
    billFrom?: BillingPartySide;
  }) => void;
}

const BillingCustomerDialog: React.FC<BillingCustomerDialogProps> = ({
  open,
  onOpenChange,
  suggestions = [],
  triedEmails = [],
  parties,
  isSubmitting,
  onConfirm,
}) => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<QuickBooksCustomerOption[]>(suggestions);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [billingEmail, setBillingEmail] = useState("");

  useEffect(() => {
    if (open) {
      setResults(suggestions);
      setSelectedId(null);
      setBillingEmail("");
      setSearch("");
    }
  }, [open, suggestions]);

  const runSearch = async () => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-inspection-invoice", {
        body: { mode: "search-customers", search },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data?.customers || []);
      if (!data?.customers?.length) toast.info("No matching QuickBooks customers found");
    } catch (error: any) {
      toast.error(error?.message || "Could not search QuickBooks customers");
    } finally {
      setIsSearching(false);
    }
  };

  const selected = results.find((c) => c.id === selectedId) || null;

  const partyList = [parties?.account, parties?.sender, parties?.receiver].filter(
    Boolean
  ) as BillingPartyDetails[];

  const sideLabels: Record<BillingPartySide, { action: string; fallback: string }> = {
    account: { action: "Bill the account that booked it", fallback: "Booking account" },
    sender: { action: "Bill the sender", fallback: "Sender" },
    receiver: { action: "Bill the receiver", fallback: "Receiver" },
  };

  const renderParty = (party: BillingPartyDetails) => {
    const email = billingEmail.trim() || party.email || "";
    const label = sideLabels[party.side].action;
    return (
      <div key={party.side} className="rounded-md border p-3 space-y-2">
        <div className="min-w-0">
          <p className="text-sm font-medium break-words">
            {party.company || party.name || sideLabels[party.side].fallback}
          </p>
          {party.company && party.name && (
            <p className="text-xs text-muted-foreground break-words">{party.name}</p>
          )}
          <p className="text-xs text-muted-foreground break-words">
            {party.email || "No email on the job"}
            {party.phone ? ` · ${party.phone}` : ""}
          </p>
          {(party.city || party.postcode) && (
            <p className="text-xs text-muted-foreground break-words">
              {[party.city, party.postcode].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={!email || isSubmitting}
          onClick={() =>
            onConfirm({
              billFrom: party.side,
              billingEmailOverride: billingEmail.trim() || undefined,
            })
          }
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {label}
        </Button>
        {!email && (
          <p className="text-xs text-muted-foreground">
            Add a billing email below to invoice them.
          </p>
        )}
      </div>
    );
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose billing customer</DialogTitle>
          <DialogDescription>
            No QuickBooks customer matched this order automatically. Pick the customer this repair
            should be invoiced to.
          </DialogDescription>
        </DialogHeader>

        {triedEmails.length > 0 && (
          <p className="text-xs text-muted-foreground break-words">
            Tried: {triedEmails.join(", ")}
          </p>
        )}

        {partyList.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Bill someone on this job</p>
            {partyList.map(renderParty)}
            <p className="text-xs text-muted-foreground">
              We'll reuse their QuickBooks account if they have one, or create it from these details.
            </p>
          </div>
        )}

        {partyList.length > 0 && (
          <p className="text-sm font-medium pt-1">Or choose an existing QuickBooks customer</p>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Search QuickBooks by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={runSearch} disabled={isSearching}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
          {results.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              Search above to find a QuickBooks customer.
            </p>
          )}
          {results.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => setSelectedId(customer.id)}
              className={`w-full min-w-0 text-left p-3 text-sm transition-colors ${
                selectedId === customer.id ? "bg-accent" : "hover:bg-muted/60"
              }`}
            >
              <span className="block font-medium break-words">{customer.name || "(no name)"}</span>
              <span className="block text-xs text-muted-foreground break-words">
                {customer.email || "No email on file"}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="billing-email-override" className="text-xs">
            Billing email (optional — overrides the customer's email)
          </Label>
          <Input
            id="billing-email-override"
            type="email"
            placeholder={selected?.email || "accounts@example.com"}
            value={billingEmail}
            onChange={(e) => setBillingEmail(e.target.value)}
          />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            className="w-full sm:w-auto"
            disabled={!selectedId || isSubmitting}
            onClick={() =>
              selectedId &&
              onConfirm({
                quickbooksCustomerId: selectedId,
                billingEmailOverride: billingEmail.trim() || undefined,
              })
            }
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Create invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BillingCustomerDialog;
