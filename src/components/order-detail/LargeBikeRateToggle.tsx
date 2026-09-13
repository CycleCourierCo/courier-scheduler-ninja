import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { hasRole } from "@/lib/roles";

interface LargeBikeRateToggleProps {
  order: any;
  onUpdate?: () => Promise<void> | void;
}

const LargeBikeRateToggle: React.FC<LargeBikeRateToggleProps> = ({ order, onUpdate }) => {
  const { userProfile } = useAuth();
  const canEdit = hasRole(userProfile, "admin") || hasRole(userProfile, "sales");

  const isOn = Boolean(order?.useLargeBikeRate ?? order?.use_large_bike_rate);
  const [saving, setSaving] = useState(false);
  const [accountRateCode, setAccountRateCode] = useState<string | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const userId = order?.user_id;
      if (!userId) {
        setLoadingAccount(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("large_bike_rate_code")
        .eq("id", userId)
        .maybeSingle();
      if (!cancelled) {
        if (error) console.error("Could not load account big-bike rate:", error.message);
        setAccountRateCode((data as any)?.large_bike_rate_code ?? null);
        setLoadingAccount(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [order?.user_id]);

  const handleToggle = async (next: boolean) => {
    if (!order?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ use_large_bike_rate: next })
        .eq("id", order.id);
      if (error) throw error;
      await onUpdate?.();
      toast.success(next ? "This job will be invoiced at the big-bike rate" : "Big-bike rate removed from this job");
    } catch (error: any) {
      console.error("Failed to update big-bike rate flag:", error);
      toast.error(error?.message || "Could not update the big-bike rate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Tick this when the bike on this job should be charged the account's agreed big-bike rate
        instead of their normal rate. It only affects invoicing.
      </p>

      <div className="flex items-center gap-3">
        <Switch
          id="use-large-bike-rate"
          checked={isOn}
          disabled={!canEdit || saving}
          onCheckedChange={handleToggle}
        />
        <Label htmlFor="use-large-bike-rate" className="text-sm">
          Charge big-bike rate
        </Label>
      </div>

      {!loadingAccount && (
        accountRateCode ? (
          <p className="text-xs text-muted-foreground">
            This account's big-bike rate: <span className="font-medium">{accountRateCode}</span>
          </p>
        ) : (
          <p className="text-xs text-destructive">
            This account has no big-bike rate set yet — add one on the account before invoicing, or the
            invoice will fail.
          </p>
        )
      )}

      {!canEdit && (
        <p className="text-xs text-muted-foreground">Only admin and sales staff can change this.</p>
      )}
    </div>
  );
};

export default LargeBikeRateToggle;
