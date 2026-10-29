import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  listCannedStats, listRejectedUses, setAutoSendMode, setBlockedFromAuto,
  type CsCannedResponse, type CsCannedStats, type AutoSendMode,
} from "@/services/cannedResponseService";
import { canEnableLive, confidenceBand, MIN_USES } from "../../../supabase/functions/_shared/cannedConfidence";

export const useCannedStats = () =>
  useQuery({ queryKey: ["cs-canned-stats"], queryFn: listCannedStats, staleTime: 30_000 });

const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export const ConfidenceBadge: React.FC<{ stats?: CsCannedStats; mode?: string }> = ({ stats, mode }) => {
  const uses = stats?.uses ?? 0;
  const band = confidenceBand(uses, stats?.confidence ?? null);
  const label = band === "learning" ? `Learning ${Math.min(uses, MIN_USES)}/${MIN_USES}` : `${pct(stats?.confidence)} ${band}`;
  const cls = band === "high" ? "border-status-success text-status-success"
    : band === "medium" ? "border-status-waiting text-status-waiting"
    : band === "low" ? "border-destructive text-destructive" : "text-muted-foreground";
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cls}`}>
      {label}{mode === "live" ? " · auto" : mode === "trial" ? " · trial" : ""}
    </Badge>
  );
};

export const CannedConfidencePanel: React.FC<{ response: CsCannedResponse; stats?: CsCannedStats }> = ({ response: r, stats }) => {
  const qc = useQueryClient();
  const { userProfile } = useAuth();
  const isAdmin = (userProfile?.roles || []).includes("admin");
  const [showRejected, setShowRejected] = useState(false);
  const [busy, setBusy] = useState(false);
  const rejected = useQuery({
    queryKey: ["cs-canned-rejected", r.id], queryFn: () => listRejectedUses(r.id), enabled: showRejected,
  });
  const mode = (r.auto_send_mode || "off") as AutoSendMode;
  const uses = stats?.uses ?? 0;
  const liveOk = canEnableLive(uses, stats?.confidence ?? null, !!r.blocked_from_auto);

  const run = async (fn: () => Promise<void>, msg: string) => {
    setBusy(true);
    try {
      await fn(); toast.success(msg);
      qc.invalidateQueries({ queryKey: ["cs-canned-responses"] });
      qc.invalidateQueries({ queryKey: ["cs-canned-stats"] });
    } catch (e: any) { toast.error(e?.message || "Couldn't save"); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-md border bg-muted/40 p-2 space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Confidence</span>
        <ConfidenceBadge stats={stats} mode={mode} />
        <span className="text-muted-foreground">
          {uses} uses · {stats?.as_is ?? 0} sent as is · {stats?.edited ?? 0} edited · {stats?.rewritten ?? 0} rewritten · {stats?.replaced ?? 0} swapped
          {(stats?.auto_sent ?? 0) > 0 && ` · ${stats!.auto_sent} auto-sent`}
          {(stats?.flagged_wrong ?? 0) > 0 && ` · ${stats!.flagged_wrong} flagged wrong`}
        </span>
      </div>
      {(stats?.trial_total ?? 0) > 0 && (
        <div className="text-muted-foreground">
          Trial: would have sent {stats!.trial_total} times · staff agreed {stats!.trial_agreed} of {stats!.trial_reviewed} answered
        </div>
      )}
      {r.auto_disabled_reason && mode === "off" && (
        <div className="text-destructive">Auto-send switched itself off: {r.auto_disabled_reason}</div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Auto-send:</span>
        {r.blocked_from_auto ? (
          <Badge variant="outline">Never auto-sent</Badge>
        ) : (["off", "trial", "live"] as AutoSendMode[]).map((m) => (
          <Button key={m} type="button" size="sm" variant={mode === m ? "default" : "outline"} className="h-7 text-xs"
            disabled={!isAdmin || busy || mode === m || (m === "live" && !liveOk)}
            title={m === "live" && !liveOk ? `Needs ${MIN_USES}+ uses and 90%+ confidence` : undefined}
            onClick={() => run(() => setAutoSendMode(r.id, m), m === "live" ? "Auto-send is on" : m === "trial" ? "Trial started" : "Auto-send off")}>
            {m === "off" ? "Off" : m === "trial" ? "Trial (log only)" : "Live"}
          </Button>
        ))}
        {isAdmin && (
          <label className="ml-auto flex items-center gap-2 text-muted-foreground">
            Never auto-send
            <Switch checked={!!r.blocked_from_auto} disabled={busy}
              onCheckedChange={(v) => run(() => setBlockedFromAuto(r.id, v), v ? "Will never auto-send" : "Can be auto-sent")} />
          </label>
        )}
      </div>
      {!isAdmin && <div className="text-muted-foreground">Only admins can change auto-send.</div>}
      <button type="button" className="underline text-muted-foreground" onClick={() => setShowRejected((v) => !v)}>
        {showRejected ? "Hide" : "Show"} recent misses
      </button>
      {showRejected && (
        <ul className="space-y-1">
          {rejected.isLoading && <li className="text-muted-foreground">Loading…</li>}
          {rejected.data?.length === 0 && <li className="text-muted-foreground">No misses yet.</li>}
          {rejected.data?.map((u: any) => (
            <li key={u.id} className="border-l-2 pl-2">
              <span className="font-medium">{u.flagged_wrong ? "Wrong auto-reply" : u.outcome === "replaced" ? "Swapped" : "Rewritten"}</span>
              {u.conv?.ticket_ref && <span className="text-muted-foreground"> · {u.conv.ticket_ref}</span>}
              <div className="text-muted-foreground line-clamp-2">{u.inbound?.body_text || "(no message text)"}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
