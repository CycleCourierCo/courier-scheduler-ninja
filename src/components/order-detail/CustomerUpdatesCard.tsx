import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Loader2, MailCheck, Send } from "lucide-react";

interface UpdateLogRow {
  id: string;
  side: string;
  stage_key: string;
  recipient: string | null;
  subject: string | null;
  sent_at: string;
}

const STAGE_LABELS: Record<string, string> = {
  booked_awaiting_request: "Booking received",
  awaiting_sender_dates: "Chasing collection dates",
  awaiting_receiver_dates: "Chasing delivery dates",
  sender_dates_received: "Dates received, planning route",
  collection_scheduled: "Collection booked",
  collection_scheduled_receiver: "Collection booked (receiver notified)",
  in_depot: "At our depot",
  delivery_scheduled: "Delivery booked",
  collection_delayed: "Collection missed - apology",
  delivery_delayed: "Delivery missed - apology",
  box_awaiting_depot: "Box My Bike: heading to depot",
  box_in_depot: "Box My Bike: at depot",
  box_boxed: "Box My Bike: boxed",
  box_awaiting_3p: "Box My Bike: awaiting courier",
  box_collected_3p: "Box My Bike: collected by courier",
  foam_pending_collection: "Foam My Bike: awaiting collection",
  foam_pending_foaming: "Foam My Bike: at depot",
  foam_ready: "Foam My Bike: ready",
  foam_at_ferry: "Reached ferry port",
};

const CustomerUpdatesCard = ({ orderId }: { orderId: string }) => {
  const [rows, setRows] = useState<UpdateLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("order_update_log")
      .select("id, side, stage_key, recipient, subject, sent_at")
      .eq("order_id", orderId)
      .order("sent_at", { ascending: false })
      .limit(25);

    if (error) {
      console.error("Failed to load customer updates", error);
    }
    setRows((data as UpdateLogRow[]) || []);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const sendNow = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-order-updates", {
        body: { orderId },
      });
      if (error) throw error;
      const sent = (data as any)?.sent ?? 0;
      if (sent > 0) {
        toast.success(`Sent ${sent} update email${sent === 1 ? "" : "s"}`);
      } else {
        toast.info("No update was due for this order right now");
      }
      await load();
    } catch (err) {
      console.error("Failed to send customer update", err);
      toast.error("Could not send the update email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <MailCheck className="h-4 w-4" />
            Customer updates
          </CardTitle>
          <CardDescription>Proactive update emails sent about this job</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={sendNow} disabled={sending} className="shrink-0">
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Send update now
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No proactive updates sent yet. Updates go out automatically each morning while the job is live.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={row.side === "sender" ? "secondary" : "outline"} className="capitalize">
                    {row.side}
                  </Badge>
                  <span className="font-medium break-words">
                    {STAGE_LABELS[row.stage_key] || row.stage_key}
                  </span>
                </div>
                <p className="mt-1 break-words text-muted-foreground">{row.recipient}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {format(parseISO(row.sent_at), "d MMM yyyy 'at' HH:mm")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default CustomerUpdatesCard;
