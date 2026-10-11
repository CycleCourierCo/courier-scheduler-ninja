import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const PARTNER_WEBHOOK_EVENTS = [
  { id: "order.created", label: "Order created" },
  { id: "order.status.updated", label: "Status updated" },
  { id: "order.collection.started", label: "Collection started" },
  { id: "order.collection.completed", label: "Collected" },
  { id: "order.delivery.started", label: "Delivery started" },
  { id: "order.delivery.completed", label: "Delivered" },
  { id: "order.delivery.failed", label: "Delivery failed" },
  { id: "order.cancelled", label: "Cancelled" },
];

interface Props {
  clientUuid: string;
  webhookUrl: string | null;
  events: string[] | null;
  secretPrefix: string | null;
  lastStatus: string | null;
  lastTriggeredAt: string | null;
  onSaved: () => void;
}

const PartnerAppWebhookEditor: React.FC<Props> = (p) => {
  const [url, setUrl] = useState(p.webhookUrl ?? "");
  const [events, setEvents] = useState<string[]>(
    p.events && p.events.length ? p.events : PARTNER_WEBHOOK_EVENTS.map(e => e.id),
  );
  const [saving, setSaving] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  const save = async (regenerate: boolean) => {
    const trimmed = url.trim();
    if (trimmed && !/^https:\/\//i.test(trimmed)) {
      toast.error("The webhook address must start with https://");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("admin_set_oauth_client_webhook" as any, {
      p_client_uuid: p.clientUuid,
      p_webhook_url: trimmed || null,
      p_events: events,
      p_regenerate_secret: regenerate,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not save the webhook");
      return;
    }
    if (data) setSecret(data as unknown as string);
    toast.success(trimmed ? "Webhook saved" : "Webhook removed");
    p.onSaved();
  };

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3">
      <Label>Order update webhook</Label>
      <p className="text-xs text-muted-foreground">
        Every customer connected to this app gets their order updates sent here automatically.
      </p>
      <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://partner.com/webhooks/cycle-courier" />
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {PARTNER_WEBHOOK_EVENTS.map(ev => (
          <label key={ev.id} className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={events.includes(ev.id)}
              onCheckedChange={c =>
                setEvents(prev => (c ? [...prev, ev.id] : prev.filter(x => x !== ev.id)))
              }
            />
            {ev.label}
          </label>
        ))}
      </div>
      {p.secretPrefix && (
        <p className="text-xs text-muted-foreground">
          Signing secret starts {p.secretPrefix}…
          {p.lastTriggeredAt ? ` · Last sent ${new Date(p.lastTriggeredAt).toLocaleString("en-GB")} (${p.lastStatus ?? "unknown"})` : ""}
        </p>
      )}
      {secret && (
        <div className="space-y-1">
          <Label>Signing secret (shown once — send it to the partner securely)</Label>
          <div className="flex gap-2">
            <Input readOnly value={secret} />
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigator.clipboard.writeText(secret).then(() => toast.success("Secret copied"))}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => save(false)} disabled={saving}>Save webhook</Button>
        {p.secretPrefix && (
          <Button size="sm" variant="outline" onClick={() => save(true)} disabled={saving}>
            New signing secret
          </Button>
        )}
      </div>
    </div>
  );
};

export default PartnerAppWebhookEditor;
