import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";

export interface PickedAccount {
  id: string;
  name: string | null;
  email: string | null;
  company_name: string | null;
  is_business?: boolean | null;
  account_status?: string | null;
}

interface Props {
  value: PickedAccount | null;
  onChange: (account: PickedAccount | null) => void;
  placeholder?: string;
  emptyLabel?: string;
}

/** Search customer accounts by name, company or email. */
const CustomerAccountPicker: React.FC<Props> = ({ value, onChange, placeholder, emptyLabel }) => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedAccount[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim().replace(/[,()%]/g, " ").trim();
    if (term.length < 2) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const like = `%${term}%`;
      const { data } = await supabase
        .from("profiles")
        .select("id, name, email, company_name, is_business, account_status")
        .or(`name.ilike.${like},email.ilike.${like},company_name.ilike.${like}`)
        .limit(15);
      if (!cancelled) { setResults((data || []) as PickedAccount[]); setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const label = (a: PickedAccount) =>
    [a.company_name, a.name].filter(Boolean).join(" — ") || a.email || "Account";

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{label(value)}</div>
          <div className="truncate text-xs text-muted-foreground">{value.email}</div>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Clear account">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder || "Search name, company or email"} />
      {emptyLabel && !q && <p className="text-xs text-muted-foreground">{emptyLabel}</p>}
      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {results.length > 0 && (
        <div className="max-h-60 overflow-y-auto rounded-md border border-border">
          {results.map((a) => {
            const blocked = !!a.is_business && a.account_status !== "approved";
            return (
              <button
                key={a.id}
                type="button"
                disabled={blocked}
                onClick={() => { onChange(a); setQ(""); setResults([]); }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
              >
                <div className="truncate font-medium">{label(a)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {a.email}{blocked ? " · not approved" : ""}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerAccountPicker;
